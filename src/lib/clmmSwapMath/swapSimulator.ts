/**
 * Raydium CLMM swap math — core swap simulation loop.
 *
 * Adapted from Raydium SDK V2 (src/raydium/clmm/libraries/swapSimulator.ts),
 * Apache-2.0. https://github.com/raydium-io/raydium-sdk-V2
 *
 * Edits vs upstream:
 * - layout `ReturnType<...>` types repointed to ./types.
 * - `./pool` -> ./poolFee, `./swapMath` -> ./swapStep, `./tickArrayUtil` ->
 *   ./tickMath, `./liquidityMath` unchanged.
 * - Account addresses are typed as the structural `PublicKeyLike` so this
 *   package needs no @solana/web3.js dependency.
 * - PDA derivation for the extra tick arrays (upstream called
 *   `TickArrayBitmapUtil.findTickArrayAddress`, which needs `./pda`) is
 *   dependency-injected via the optional `getTickArrayAddress` callback so the
 *   math stays free of RPC/Raydium-glue deps. The Raydium glue (Phase 3/5)
 *   supplies it; unit tests pass `includeExtraTickArrays: false`.
 */
import BN from "bn.js";
import { BN_ZERO, MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64 } from "./constants";
import { LiquidityMathUtil } from "./liquidityMath";
import { PoolUtil } from "./poolFee";
import { SwapMathUtil, SwapState } from "./swapStep";
import { TickArrayBitmapUtil, TickArrayUtil, TickUtil } from "./tickMath";
import type {
  ClmmConfigDecoded,
  PoolInfoDecoded,
  PublicKeyLike,
  TickArrayBitmapExtensionDecoded,
  TickArrayDecoded,
} from "./types";

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
  isBaseInput,
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
  isBaseInput: boolean;
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
        isBaseInput,
        zeroForOne,
        isFeeOnInput,
      );

      SwapState.applySwapAmounts({
        state,
        amountIn: swapComputedResult.amountIn,
        amountOut: swapComputedResult.amountOut,
        feeAmount: swapComputedResult.feeAmount,
        isBaseInput,
        isFeeOnInput,
        protocolFeeRate: new BN(configInfo.protocolFeeRate),
        fundFeeRate: new BN(configInfo.fundFeeRate),
      });
    } else {
      swapComputedResult = SwapMathUtil.newSwapComputationResult({ sqrtPriceNextX64: targetPrice });
    }

    if (state.sqrtPriceNextX64.eq(swapComputedResult.sqrtPriceNextX64)) {
      const limitOrderResult = TickUtil.matchLimitOrder({
        tick: nextInitializedTick,
        swapAmount: state.amountSpecifiedRemaining,
        swapDirectionZeroForOne: zeroForOne,
        isBaseInput,
        feeRate,
        isFeeOnInput,
      });

      if (limitOrderResult.amountIn.gt(BN_ZERO)) {
        SwapState.applySwapAmounts({
          state,
          amountIn: limitOrderResult.amountIn,
          amountOut: limitOrderResult.amountOut,
          feeAmount: limitOrderResult.ammFeeAmount,
          isBaseInput,
          isFeeOnInput,
          protocolFeeRate: new BN(configInfo.protocolFeeRate),
          fundFeeRate: new BN(configInfo.fundFeeRate),
        });
      }

      if (
        TickUtil.hasLiquidity({ data: nextInitializedTick }) &&
        !TickUtil.hasLimitOrders({ data: nextInitializedTick })
      ) {
        const liquidityNet = zeroForOne ? nextInitializedTick.liquidityNet.neg() : nextInitializedTick.liquidityNet;

        liquidityNext = LiquidityMathUtil.addDelta(state.liquidity, liquidityNet);
      }

      state.tick =
        (zeroForOne && !TickUtil.hasLimitOrders({ data: nextInitializedTick })) ||
          (!zeroForOne && TickUtil.hasLimitOrders({ data: nextInitializedTick }))
          ? state.tickNext - 1
          : state.tickNext;
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
