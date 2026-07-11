/**
 * clmmSwapMath — thin, in-house exact-in / exact-out wrappers.
 *
 * These are the public entry points of the math package. They wrap the core
 * `swapInternal` loop the same way Raydium SDK V2's
 * PoolUtils.getOutputAmountAndRemainAccounts / getInputAmountAndRemainAccounts
 * do, but WITHOUT dragging in `@/api`, `@/common`, `@/module`. Inputs are plain
 * decoded structs + BN; outputs are plain BN + address list.
 */
import BN from "bn.js";
import { BN_ZERO } from "./constants";
import { swapInternal } from "./swapSimulator";
import { TickArrayUtil } from "./tickMath";
import type {
  ClmmConfigDecoded,
  PoolInfoDecoded,
  PublicKeyLike,
  TickArrayBitmapExtensionDecoded,
  TickArrayDecoded,
} from "./types";

export interface SwapExactInParams {
  poolInfo: PoolInfoDecoded;
  ammConfig: ClmmConfigDecoded;
  /** Candidate tick arrays fetched around the current tick (any order). */
  tickArrays: { address: PublicKeyLike; value: TickArrayDecoded }[];
  bitmapExt: TickArrayBitmapExtensionDecoded;
  inputMint: PublicKeyLike;
  amountIn: BN;
  /** 0 = unbounded (default). */
  sqrtPriceLimitX64?: BN;
  /** Derives PDAs for extra tick arrays the swap may cross (Raydium glue supplies it). */
  getTickArrayAddress?: (startIndex: number) => PublicKeyLike;
}

export interface SwapExactInResult {
  amountOut: BN;
  remainingAccounts: PublicKeyLike[];
  feeAmount: BN;
  /** false when the pool lacked enough liquidity/tick arrays to fill fully. */
  allTrade: boolean;
}

function selectTickArrays(
  tickArrays: { address: PublicKeyLike; value: TickArrayDecoded }[],
  tickCurrent: number,
  tickSpacing: number,
  zeroForOne: boolean,
): { address: PublicKeyLike; value: TickArrayDecoded }[] {
  const currentStart = TickArrayUtil.getTickArrayStartIndex(tickCurrent, tickSpacing);
  return tickArrays
    .filter((a) =>
      zeroForOne ? a.value.startTickIndex <= currentStart : a.value.startTickIndex >= currentStart,
    )
    .sort((a, b) =>
      zeroForOne
        ? b.value.startTickIndex - a.value.startTickIndex
        : a.value.startTickIndex - b.value.startTickIndex,
    );
}

/**
 * Exact-in swap simulation. Returns the expected output amount and the ordered
 * list of tick-array accounts the on-chain swap_v2 will touch
 * (`remainingAccounts`). `isBaseInput` is always true here.
 */
export function swapExactIn(params: SwapExactInParams): SwapExactInResult {
  const { poolInfo, ammConfig, tickArrays, bitmapExt, inputMint, amountIn } = params;

  const zeroForOne = inputMint.toString() === poolInfo.mintA.toString();

  const sorted = selectTickArrays(tickArrays, poolInfo.tickCurrent, poolInfo.tickSpacing, zeroForOne);

  const res = swapInternal({
    poolInfo,
    tickArrays: sorted,
    configInfo: ammConfig,
    tickarrayBitmapExtension: bitmapExt,
    amountSpecified: amountIn,
    sqrtPriceLimitX64: params.sqrtPriceLimitX64 ?? BN_ZERO,
    zeroForOne,
    isBaseInput: true,
    includeExtraTickArrays: true,
    getTickArrayAddress: params.getTickArrayAddress,
  });

  return {
    amountOut: res.amountCalculated,
    remainingAccounts: res.accounts,
    feeAmount: res.feeAmount,
    allTrade: res.allTrade,
  };
}
