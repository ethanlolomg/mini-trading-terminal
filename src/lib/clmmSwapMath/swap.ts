/**
 * clmmSwapMath — the exact-in swap engine.
 *
 * Adapted from Raydium SDK V2 (Apache-2.0): pool-fee helper, single-step swap
 * math, the tick-crossing loop, and the in-house `swapExactIn` entry point.
 * https://github.com/raydium-io/raydium-sdk-V2
 */
import BN from "bn.js";
import {
  BN_ZERO,
  CollectFeeOn,
  FEE_RATE_DENOMINATOR,
  FEE_RATE_DENOMINATOR_VALUE,
  MAX_SQRT_PRICE_X64,
  MAX_TICK,
  MIN_SQRT_PRICE_X64,
  MIN_TICK,
  Q64,
  mulDivCeil,
  mulDivFloor,
  LiquidityMathUtil,
  SqrtPriceMath,
  TickArrayBitmapUtil,
  TickArrayUtil,
  TickUtil,
} from "./math";
import type {
  ClmmConfigDecoded,
  PoolInfoDecoded,
  PublicKeyLike,
  TickArrayBitmapExtensionDecoded,
  TickArrayDecoded,
} from "./types";

// ===================== pool fee =====================
export class PoolUtil {
  static isFeeOnInput(feeOn: number, zeroForOne: boolean): boolean {
    switch (feeOn) {
      case CollectFeeOn.FromInput:
        return true;
      case CollectFeeOn.TokenOnlyA:
        return zeroForOne;
      case CollectFeeOn.TokenOnlyB:
        return !zeroForOne;
      default:
        return true;
    }
  }
}

// ===================== single-step swap math =====================
export interface SwapStepResult {
  sqrtPriceNextX64: BN
  amountIn: BN
  amountOut: BN
  feeAmount: BN
}

interface SwapStateInterface {
  amountSpecifiedRemaining: BN,
  amountCalculated: BN,
  sqrtPriceX64: BN,
  tick: number,
  feeGrowthGlobalX64: BN,
  lpFee: BN,
  protocolFee: BN,
  fundFee: BN,
  liquidity: BN,
  sqrtPriceNextX64: BN,
  tickNext: number,
  feeRate: number,
  tickSpacing: number,
}
export class SwapState {
  static newValue({ poolInfo, amountSpecified, zeroForOne, feeRate }: {
    poolInfo: PoolInfoDecoded,
    amountSpecified: BN,
    zeroForOne: boolean,
    feeRate: number,
  }): SwapStateInterface {
    return {
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: BN_ZERO,
      sqrtPriceX64: poolInfo.sqrtPriceX64,
      tick: poolInfo.tickCurrent,
      feeGrowthGlobalX64: zeroForOne ? poolInfo.feeGrowthGlobalX64A : poolInfo.feeGrowthGlobalX64B,
      lpFee: BN_ZERO,
      protocolFee: BN_ZERO,
      fundFee: BN_ZERO,
      liquidity: poolInfo.liquidity,
      sqrtPriceNextX64: BN_ZERO,
      tickNext: 0,
      feeRate,
      tickSpacing: poolInfo.tickSpacing,
    }
  }

  static getTargetPriceBasedOnNextTick({ data, tickNext, zeroForOne, sqrtPriceLimitX64 }: {
    data: SwapStateInterface,
    tickNext: number,
    zeroForOne: boolean,
    sqrtPriceLimitX64: BN,
  }) {
    data.tickNext = tickNext
    if (data.tickNext < MIN_TICK) {
      data.tickNext = MIN_TICK
    } else if (data.tickNext > MAX_TICK) {
      data.tickNext = MAX_TICK
    }

    data.sqrtPriceNextX64 = TickUtil.getSqrtPriceAtTick(data.tickNext)

    let targetPrice: BN

    if ((zeroForOne && data.sqrtPriceNextX64.lt(sqrtPriceLimitX64)) || (!zeroForOne && data.sqrtPriceNextX64.gt(sqrtPriceLimitX64))) {
      targetPrice = sqrtPriceLimitX64
    } else {
      targetPrice = data.sqrtPriceNextX64
    }

    if (zeroForOne) {
      if (data.tick < data.tickNext) throw Error('data.tick < data.tickNext')
      if (data.sqrtPriceX64.lt(data.sqrtPriceNextX64)) throw Error('data.sqrtPriceX64.lt(data.sqrtPriceNextX64)')
      if (data.sqrtPriceX64.lt(targetPrice)) throw Error('data.sqrtPriceX64.lt(targetPrice)')
    } else {
      if (data.tickNext <= data.tick) throw Error('data.tickNext <= data.tick')
      if (data.sqrtPriceNextX64.lt(data.sqrtPriceX64)) throw Error('data.sqrtPriceNextX64.lt(data.sqrtPriceX64)')
      if (targetPrice.lt(data.sqrtPriceX64)) throw Error('targetPrice.lt(data.sqrtPriceX64)')
    }

    return targetPrice
  }

  static applySwapAmounts({ state, amountIn, amountOut, feeAmount, isFeeOnInput, protocolFeeRate, fundFeeRate, }: {
    state: SwapStateInterface,
    amountIn: BN,
    amountOut: BN,
    feeAmount: BN,
    isFeeOnInput: boolean,
    protocolFeeRate: BN,
    fundFeeRate: BN,
  }) {
    const amountInConsumed = isFeeOnInput ? amountIn.add(feeAmount) : amountIn

    state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.sub(amountInConsumed)
    state.amountCalculated = state.amountCalculated.add(amountOut)

    this.splitFee({ state, feeAmount, protocolFeeRate, fundFeeRate })
  }

  static splitFee({ state, feeAmount, protocolFeeRate, fundFeeRate }: {
    state: SwapStateInterface,
    feeAmount: BN,
    protocolFeeRate: BN,
    fundFeeRate: BN
  }) {
    let remainingFee = feeAmount
    if (protocolFeeRate.gt(BN_ZERO)) {
      const protocolFeeDelta = feeAmount.mul(protocolFeeRate).div(FEE_RATE_DENOMINATOR_VALUE)
      state.protocolFee = state.protocolFee.add(protocolFeeDelta)
      remainingFee = remainingFee.sub(protocolFeeDelta)
    }

    if (fundFeeRate.gt(BN_ZERO)) {
      const fundFeeDelta = feeAmount.mul(fundFeeRate).div(FEE_RATE_DENOMINATOR_VALUE)
      state.fundFee = state.fundFee.add(fundFeeDelta)
      remainingFee = remainingFee.sub(fundFeeDelta)
    }

    if (state.liquidity.gt(BN_ZERO)) {
      const feeGrowthGlobalX64Delta = mulDivFloor(remainingFee, Q64, state.liquidity)
      state.feeGrowthGlobalX64 = state.feeGrowthGlobalX64.add(feeGrowthGlobalX64Delta)
      state.lpFee = state.lpFee.add(remainingFee)
    }
  }

}

export type { SwapStateInterface }

export class SwapMathUtil {
  static newSwapComputationResult({ sqrtPriceNextX64 }: { sqrtPriceNextX64?: BN }): SwapStepResult {
    return {
      sqrtPriceNextX64: sqrtPriceNextX64 ?? BN_ZERO,
      amountIn: BN_ZERO,
      amountOut: BN_ZERO,
      feeAmount: BN_ZERO,
    }
  }

  static calculateAmountInRange({ sqrtPriceCurrentX64, sqrtPriceTargetX64, liquidity, zeroForOne }: {
    sqrtPriceCurrentX64: BN,
    sqrtPriceTargetX64: BN,
    liquidity: BN,
    zeroForOne: boolean,
  }) {
    try {
      return zeroForOne
        ? LiquidityMathUtil.getDeltaAmountAUnsigned(sqrtPriceTargetX64, sqrtPriceCurrentX64, liquidity, true)
        : LiquidityMathUtil.getDeltaAmountBUnsigned(sqrtPriceCurrentX64, sqrtPriceTargetX64, liquidity, true)
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (e.message === 'MaxTokenOverflow') return null
      throw e
    }
  }

  /** Single exact-in swap step from the current price toward the target price. */
  static computeSwap(
    sqrtPriceCurrentX64: BN,
    sqrtPriceTargetX64: BN,
    liquidity: BN,
    amountRemaining: BN,
    feeRate: number,
    zeroForOne: boolean,
    isFeeOnInput: boolean
  ): SwapStepResult {
    const result = this.newSwapComputationResult({})

    const amountForPriceCalc = isFeeOnInput ? mulDivFloor(amountRemaining, new BN(FEE_RATE_DENOMINATOR - feeRate), new BN(FEE_RATE_DENOMINATOR)) : amountRemaining

    const amountIn = this.calculateAmountInRange({ sqrtPriceCurrentX64, sqrtPriceTargetX64, liquidity, zeroForOne })

    if (amountIn !== null) result.amountIn = amountIn

    result.sqrtPriceNextX64 = amountIn !== null && amountForPriceCalc.gte(result.amountIn) ? sqrtPriceTargetX64 : SqrtPriceMath.getNextSqrtPriceFromInput(sqrtPriceCurrentX64, liquidity, amountForPriceCalc, zeroForOne)

    if (zeroForOne) {
      if (!result.sqrtPriceNextX64.gte(sqrtPriceTargetX64)) throw Error('!result.sqrtPriceNextX64.gte(sqrtPriceTargetX64)')
    } else {
      if (!sqrtPriceTargetX64.gte(result.sqrtPriceNextX64)) throw Error('!sqrtPriceTargetX64.gte(result.sqrtPriceNextX64)')
    }

    const max = sqrtPriceTargetX64.eq(result.sqrtPriceNextX64)

    if (zeroForOne) {
      if (!max) {
        result.amountIn = LiquidityMathUtil.getDeltaAmountAUnsigned(result.sqrtPriceNextX64, sqrtPriceCurrentX64, liquidity, true)
      }
      result.amountOut = LiquidityMathUtil.getDeltaAmountBUnsigned(result.sqrtPriceNextX64, sqrtPriceCurrentX64, liquidity, false)
    } else {
      if (!max) {
        result.amountIn = LiquidityMathUtil.getDeltaAmountBUnsigned(sqrtPriceCurrentX64, result.sqrtPriceNextX64, liquidity, true)
      }
      result.amountOut = LiquidityMathUtil.getDeltaAmountAUnsigned(sqrtPriceCurrentX64, result.sqrtPriceNextX64, liquidity, false)
    }

    if (isFeeOnInput) {
      if (!result.sqrtPriceNextX64.eq(sqrtPriceTargetX64)) {
        result.feeAmount = amountRemaining.sub(result.amountIn)
      } else {
        result.feeAmount = mulDivCeil(
          result.amountIn,
          new BN(feeRate),
          new BN(FEE_RATE_DENOMINATOR - feeRate)
        )
      }
    } else {
      result.feeAmount = mulDivCeil(result.amountOut, new BN(feeRate), new BN(FEE_RATE_DENOMINATOR))
      result.amountOut = result.amountOut.sub(result.feeAmount)

      if (!max) {
        result.amountIn = amountRemaining
      }
    }

    return result
  }
}

// ===================== swap loop =====================
export interface SwapSimulationResult {
  allTrade: boolean;
  amountSpecifiedRemaining: BN;
  amountCalculated: BN;
  feeAmount: BN;
  sqrtPriceX64: BN;
  liquidity: BN;
  tickCurrent: number;
  accounts: PublicKeyLike[];
}

export function swapInternal({
  poolInfo,
  tickArrays,
  configInfo,
  tickarrayBitmapExtension,
  amountSpecified,
  sqrtPriceLimitX64,
  zeroForOne,
  includeExtraTickArrays,
  getTickArrayAddress,
}: {
  poolInfo: PoolInfoDecoded;
  tickArrays: { address: PublicKeyLike; value: TickArrayDecoded }[];
  configInfo: ClmmConfigDecoded;
  tickarrayBitmapExtension: TickArrayBitmapExtensionDecoded;
  amountSpecified: BN;
  sqrtPriceLimitX64: BN;
  zeroForOne: boolean;
  includeExtraTickArrays: boolean;
  getTickArrayAddress?: (startIndex: number) => PublicKeyLike;
}): SwapSimulationResult {
  if (sqrtPriceLimitX64.isZero()) {
    sqrtPriceLimitX64 = zeroForOne ? new BN(MIN_SQRT_PRICE_X64).addn(1) : new BN(MAX_SQRT_PRICE_X64).subn(1);
  }

  let tickArrayListIndex = 0;

  if (tickArrays.length === 0) {
    return {
      allTrade: false,
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: BN_ZERO,
      feeAmount: BN_ZERO,
      sqrtPriceX64: poolInfo.sqrtPriceX64,
      liquidity: poolInfo.liquidity,
      tickCurrent: poolInfo.tickCurrent,
      accounts: [],
    };
  }

  const addTickArrayAddress =
    includeExtraTickArrays && getTickArrayAddress
      ? TickArrayBitmapUtil.findTickArrayStartIndex({
          tickSpacing: poolInfo.tickSpacing,
          poolBitmap: poolInfo.tickArrayBitmap,
          tickArrayBitmap: tickarrayBitmapExtension,
          findInfo: { type: !zeroForOne ? "zeroForOne" : "oneForZero", count: 2, tickArrayCurrent: poolInfo.tickCurrent },
        })
          .map(getTickArrayAddress)
          .filter((i) => i.toString() !== tickArrays[0].address.toString())
      : [];

  const _startTickIndex = TickArrayUtil.getTickArrayStartIndex(poolInfo.tickCurrent, poolInfo.tickSpacing);
  let firstItckArrayContainsPoolTick = tickArrays[tickArrayListIndex].value.startTickIndex === _startTickIndex;

  let tickArrayCurrent = tickArrays[tickArrayListIndex];

  const isFeeOnInput = PoolUtil.isFeeOnInput(poolInfo.feeOn, zeroForOne);

  const state = SwapState.newValue({
    poolInfo,
    amountSpecified,
    zeroForOne,
    feeRate: configInfo.tradeFeeRate,
  });

  while (!state.amountSpecifiedRemaining.isZero() && !state.sqrtPriceX64.eq(sqrtPriceLimitX64)) {
    const nextInitializedTick = (() => {
      const tickState = TickArrayUtil.nextInitalizedTick({
        data: tickArrayCurrent.value,
        tickSpacing: state.tickSpacing,
        zeroForOne,
        currentTickIndex: state.tick,
      });
      if (tickState !== undefined) {
        return tickState;
      } else if (!firstItckArrayContainsPoolTick) {
        firstItckArrayContainsPoolTick = true;
        return TickArrayUtil.firstinitializedTick({ data: tickArrayCurrent.value, zeroForOne });
      } else {
        const nextTickArrayIndex = tickArrays[++tickArrayListIndex];
        if (nextTickArrayIndex === undefined) {
          return undefined;
        }

        tickArrayCurrent = nextTickArrayIndex;
        return TickArrayUtil.firstinitializedTick({ data: nextTickArrayIndex.value, zeroForOne });
      }
    })();

    if (nextInitializedTick === undefined) {
      return {
        allTrade: false,
        amountSpecifiedRemaining: state.amountSpecifiedRemaining,
        amountCalculated: state.amountCalculated,
        feeAmount: state.lpFee.add(state.fundFee).add(state.protocolFee),
        sqrtPriceX64: state.sqrtPriceX64,
        liquidity: state.liquidity,
        tickCurrent: state.tick,
        accounts: tickArrays.slice(0, tickArrayListIndex).map((i) => i.address),
      };
    }

    const targetPrice = SwapState.getTargetPriceBasedOnNextTick({
      data: state,
      tickNext: nextInitializedTick.tick,
      zeroForOne,
      sqrtPriceLimitX64,
    });

    let liquidityNext = state.liquidity;
    const feeRate = state.feeRate;
    const isPriceChange = !state.sqrtPriceX64.eq(targetPrice);

    let swapComputedResult;
    if (isPriceChange) {
      swapComputedResult = SwapMathUtil.computeSwap(
        state.sqrtPriceX64,
        targetPrice,
        state.liquidity,
        state.amountSpecifiedRemaining,
        feeRate,
        zeroForOne,
        isFeeOnInput,
      );

      SwapState.applySwapAmounts({
        state,
        amountIn: swapComputedResult.amountIn,
        amountOut: swapComputedResult.amountOut,
        feeAmount: swapComputedResult.feeAmount,
        isFeeOnInput,
        protocolFeeRate: new BN(configInfo.protocolFeeRate),
        fundFeeRate: new BN(configInfo.fundFeeRate),
      });
    } else {
      swapComputedResult = SwapMathUtil.newSwapComputationResult({ sqrtPriceNextX64: targetPrice });
    }

    if (state.sqrtPriceNextX64.eq(swapComputedResult.sqrtPriceNextX64)) {
      // Crossing an initialized tick: apply its net liquidity and step past it.
      const liquidityNet = zeroForOne ? nextInitializedTick.liquidityNet.neg() : nextInitializedTick.liquidityNet;
      liquidityNext = LiquidityMathUtil.addDelta(state.liquidity, liquidityNet);
      state.tick = zeroForOne ? state.tickNext - 1 : state.tickNext;
    } else if (!state.sqrtPriceX64.eq(swapComputedResult.sqrtPriceNextX64)) {
      state.tick = TickUtil.getTickAtSqrtPrice(swapComputedResult.sqrtPriceNextX64);
    }

    state.sqrtPriceX64 = swapComputedResult.sqrtPriceNextX64;
    state.liquidity = liquidityNext;
  }

  return {
    allTrade: true,
    amountSpecifiedRemaining: BN_ZERO,
    amountCalculated: state.amountCalculated,
    feeAmount: state.lpFee.add(state.fundFee).add(state.protocolFee),
    sqrtPriceX64: state.sqrtPriceX64,
    liquidity: state.liquidity,
    tickCurrent: state.tick,
    accounts: [
      ...addTickArrayAddress,
      ...tickArrays.slice(0, tickArrayListIndex + 1 + (includeExtraTickArrays ? 1 : 0)).map((i) => i.address),
    ],
  };
}

// ===================== exact-in entry point =====================
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
 * (`remainingAccounts`).
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
