import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { swapExactIn } from "@/lib/clmmSwapMath";
import type { SwapParams } from "../../types";
import { RAYDIUM_CLMM_PROGRAM_ID } from "./constants";
import { fetchClmmPool, fetchTickArraysForSwap } from "./fetchPool";
import { getPdaTickArrayAddress } from "./pda";
import { buildSwapV2Instruction } from "./swapV2Ix";

const DEFAULT_SLIPPAGE_BPS = 100; // 1%
const COMPUTE_UNIT_LIMIT = 600_000;

/**
 * Build a signed-ready VersionedTransaction for an exact-in Raydium CLMM swap
 * via swap_v2. Reads pool state through the provided (Helius) connection, runs
 * the in-house swap simulation for amountOut + tick-array accounts, wraps/unwraps
 * WSOL as needed, and assembles a v0 message.
 */
export async function buildRaydiumClmmSwapTx(params: SwapParams): Promise<VersionedTransaction> {
  const { inputMint, outputMint, amount, signer, connection, poolAddress } = params;
  if (!poolAddress) throw new Error("raydium-clmm route requires a poolAddress");
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

  const poolId = new PublicKey(poolAddress);
  const ctx = await fetchClmmPool(connection, poolId);
  const { poolInfo, ammConfig, bitmapExt, exBitmapAddress } = ctx;

  const mintA = poolInfo.mintA as unknown as PublicKey;
  const mintB = poolInfo.mintB as unknown as PublicKey;
  const vaultA = poolInfo.vaultA as unknown as PublicKey;
  const vaultB = poolInfo.vaultB as unknown as PublicKey;
  const observationState = poolInfo.observationId as unknown as PublicKey;

  const zeroForOne = inputMint.equals(mintA);
  if (!zeroForOne && !inputMint.equals(mintB)) {
    throw new Error("input mint does not belong to this pool");
  }

  const tickArrays = await fetchTickArraysForSwap(connection, ctx);

  const { amountOut, remainingAccounts, allTrade } = swapExactIn({
    poolInfo,
    ammConfig,
    tickArrays,
    bitmapExt,
    inputMint,
    amountIn: amount,
    getTickArrayAddress: (startIndex) => getPdaTickArrayAddress(RAYDIUM_CLMM_PROGRAM_ID, poolId, startIndex),
  });

  if (amountOut.lten(0)) {
    throw new Error("Raydium CLMM swap simulation produced zero output");
  }
  if (!allTrade) {
    // Not enough liquidity/tick arrays fetched to fill the whole input.
    throw new Error("Raydium CLMM pool cannot fill the full input amount");
  }

  // Slippage floor: otherAmountThreshold = amountOut * (1 - slippageBps/1e4).
  const otherAmountThreshold = amountOut.mul(new BN(10_000 - slippageBps)).div(new BN(10_000));

  // Resolve the token program owning each mint (WSOL -> Token, TRUMP -> Token-2022).
  const [inMintAcc, outMintAcc] = await connection.getMultipleAccountsInfo([inputMint, outputMint]);
  const inputProgram = inMintAcc?.owner ?? SPL_TOKEN_PROGRAM_ID;
  const outputProgram = outMintAcc?.owner ?? SPL_TOKEN_PROGRAM_ID;

  const inputTokenAccount = getAssociatedTokenAddressSync(inputMint, signer, false, inputProgram);
  const outputTokenAccount = getAssociatedTokenAddressSync(outputMint, signer, false, outputProgram);

  const inputIsSol = inputMint.equals(NATIVE_MINT);
  const outputIsSol = outputMint.equals(NATIVE_MINT);

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    createAssociatedTokenAccountIdempotentInstruction(signer, inputTokenAccount, signer, inputMint, inputProgram),
    createAssociatedTokenAccountIdempotentInstruction(signer, outputTokenAccount, signer, outputMint, outputProgram),
  ];

  // Wrap SOL: fund the WSOL ATA with the input lamports and sync.
  if (inputIsSol) {
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: signer,
        toPubkey: inputTokenAccount,
        lamports: BigInt(amount.toString()),
      }),
      createSyncNativeInstruction(inputTokenAccount, inputProgram),
    );
  }

  ixs.push(
    buildSwapV2Instruction(
      {
        payer: signer,
        ammConfig: poolInfo.configId as unknown as PublicKey,
        poolState: poolId,
        inputTokenAccount,
        outputTokenAccount,
        inputVault: zeroForOne ? vaultA : vaultB,
        outputVault: zeroForOne ? vaultB : vaultA,
        observationState,
        inputVaultMint: inputMint,
        outputVaultMint: outputMint,
        tickArrayBitmapExtension: exBitmapAddress,
        tickArrays: remainingAccounts as unknown as PublicKey[],
      },
      { amount, otherAmountThreshold, sqrtPriceLimitX64: new BN(0), isBaseInput: true },
    ),
  );

  // Unwrap: close the WSOL ATA to recover native SOL (leftover input dust on buy,
  // or the full proceeds on sell).
  if (inputIsSol) {
    ixs.push(createCloseAccountInstruction(inputTokenAccount, signer, signer, [], inputProgram));
  }
  if (outputIsSol) {
    ixs.push(createCloseAccountInstruction(outputTokenAccount, signer, signer, [], outputProgram));
  }

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: signer,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
