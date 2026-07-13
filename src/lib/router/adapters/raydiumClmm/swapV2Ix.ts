import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import {
  MEMO_PROGRAM_ID,
  RAYDIUM_CLMM_PROGRAM_ID,
  SWAP_V2_DISCRIMINATOR,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./constants";

export interface SwapV2Accounts {
  payer: PublicKey;
  ammConfig: PublicKey;
  poolState: PublicKey;
  inputTokenAccount: PublicKey;
  outputTokenAccount: PublicKey;
  inputVault: PublicKey;
  outputVault: PublicKey;
  observationState: PublicKey;
  inputVaultMint: PublicKey;
  outputVaultMint: PublicKey;
  /** Optional bitmap extension (writable) placed before the tick arrays. */
  tickArrayBitmapExtension?: PublicKey;
  /** Tick arrays from the swap simulation's remainingAccounts (writable). */
  tickArrays: PublicKey[];
}

export interface SwapV2Args {
  amount: BN;
  otherAmountThreshold: BN;
  sqrtPriceLimitX64: BN;
  isBaseInput: boolean;
}

function encodeArgs(args: SwapV2Args): Buffer {
  // borsh: amount u64, otherAmountThreshold u64, sqrtPriceLimitX64 u128, isBaseInput bool
  return Buffer.concat([
    SWAP_V2_DISCRIMINATOR,
    args.amount.toArrayLike(Buffer, "le", 8),
    args.otherAmountThreshold.toArrayLike(Buffer, "le", 8),
    args.sqrtPriceLimitX64.toArrayLike(Buffer, "le", 16),
    Buffer.from([args.isBaseInput ? 1 : 0]),
  ]);
}

/**
 * Build the Raydium CLMM `swap_v2` instruction. Account order matches the
 * on-chain program (payer, amm_config, pool_state, input/output token accounts,
 * input/output vaults, observation_state, token programs, memo, input/output
 * vault mints, [tick_array_bitmap_extension], tick_arrays...).
 */
export function buildSwapV2Instruction(accounts: SwapV2Accounts, args: SwapV2Args): TransactionInstruction {
  const keys = [
    { pubkey: accounts.payer, isSigner: true, isWritable: false },
    { pubkey: accounts.ammConfig, isSigner: false, isWritable: false },
    { pubkey: accounts.poolState, isSigner: false, isWritable: true },
    { pubkey: accounts.inputTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.outputTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.inputVault, isSigner: false, isWritable: true },
    { pubkey: accounts.outputVault, isSigner: false, isWritable: true },
    { pubkey: accounts.observationState, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: MEMO_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: accounts.inputVaultMint, isSigner: false, isWritable: false },
    { pubkey: accounts.outputVaultMint, isSigner: false, isWritable: false },
    ...(accounts.tickArrayBitmapExtension
      ? [{ pubkey: accounts.tickArrayBitmapExtension, isSigner: false, isWritable: true }]
      : []),
    ...accounts.tickArrays.map((pk) => ({ pubkey: pk, isSigner: false, isWritable: true })),
  ];

  return new TransactionInstruction({
    keys,
    programId: RAYDIUM_CLMM_PROGRAM_ID,
    data: encodeArgs(args),
  });
}
