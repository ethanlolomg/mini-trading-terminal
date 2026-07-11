/**
 * Raydium CLMM swap math — pool fee helpers.
 *
 * Adapted from Raydium SDK V2 (src/raydium/clmm/libraries/pool.ts, lines
 * 17-226), Apache-2.0. https://github.com/raydium-io/raydium-sdk-V2
 *
 * Only the pure fee/dynamic-fee primitives (PoolFee, DynamicFeeInfo and the
 * stateless PoolUtil helpers) are kept. The heavy PoolUtils methods that need
 * RPC (`@/common`), `@/api`, `@/module` are intentionally left behind — Phase 4
 * provides thin in-house exact-in/out wrappers instead.
 *
 * Edits vs upstream: layout `ReturnType<...>` types repointed to ./types and
 * tick utils repointed to ./tickMath.
 */
import { TickArrayBitmapUtil, TickArrayUtil } from "./tickMath";
import { MAX_TICK, MIN_TICK, REDUCTION_FACTOR_DENOMINATOR, VOLATILITY_ACCUMULATOR_SCALE, CollectFeeOn } from "./constants";
import type { DynamicFeeInfoState, PoolInfoDecoded } from "./types";
import BN from "bn.js";

export class PoolFee {
  static tickSpacingIndexFromTick(tickIndex: number, tickSpacing: number): number {
    return Math.floor(tickIndex / tickSpacing);
  }
}

export class DynamicFeeInfo {
  static getDynamicFeeInfo({ poolInfo }: { poolInfo: PoolInfoDecoded }): DynamicFeeInfoState | undefined {
    if (
      poolInfo.dynamicFeeInfo.filterPeriod === 0 &&
      poolInfo.dynamicFeeInfo.decayPeriod === 0 &&
      poolInfo.dynamicFeeInfo.reductionFactor === 0 &&
      poolInfo.dynamicFeeInfo.dynamicFeeControl === 0 &&
      poolInfo.dynamicFeeInfo.maxVolatilityAccumulator === 0 &&
      poolInfo.dynamicFeeInfo.tickSpacingIndexReference === 0 &&
      poolInfo.dynamicFeeInfo.volatilityReference === 0 &&
      poolInfo.dynamicFeeInfo.volatilityAccumulator === 0 &&
      poolInfo.dynamicFeeInfo.lastUpdateTimestamp.isZero()
    ) {
      return undefined;
    }
    return poolInfo.dynamicFeeInfo;
  }

  static updateReference({
    dynamicFeeInfo,
    tickSpacingIndex,
    currentTimestamp,
  }: {
    dynamicFeeInfo: DynamicFeeInfoState;
    tickSpacingIndex: number;
    currentTimestamp: number;
  }) {
    const timeSinceReferenceUpdate = currentTimestamp - dynamicFeeInfo.lastUpdateTimestamp.toNumber();

    if (timeSinceReferenceUpdate < dynamicFeeInfo.filterPeriod) {
      //
    } else if (timeSinceReferenceUpdate < dynamicFeeInfo.decayPeriod) {
      dynamicFeeInfo.tickSpacingIndexReference = tickSpacingIndex;
      dynamicFeeInfo.volatilityReference = Math.floor(
        (dynamicFeeInfo.volatilityAccumulator * dynamicFeeInfo.reductionFactor) / REDUCTION_FACTOR_DENOMINATOR,
      );
      dynamicFeeInfo.lastUpdateTimestamp = new BN(currentTimestamp);
    } else {
      dynamicFeeInfo.tickSpacingIndexReference = tickSpacingIndex;
      dynamicFeeInfo.volatilityReference = 0;
      dynamicFeeInfo.lastUpdateTimestamp = new BN(currentTimestamp);
    }
  }

  static updateVolatilityAccumulator({
    state,
    tickSpacingIndex,
  }: {
    state: DynamicFeeInfoState;
    tickSpacingIndex: number;
  }) {
    const indexDelta = Math.abs(state.tickSpacingIndexReference - tickSpacingIndex);
    const volatilityAccumulator = state.volatilityReference + indexDelta * VOLATILITY_ACCUMULATOR_SCALE;

    state.volatilityAccumulator = Math.min(volatilityAccumulator, state.maxVolatilityAccumulator);
  }
}

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

  static isFeeOnTokenA(poolInfo: PoolInfoDecoded, zeroForOne: boolean) {
    if (poolInfo.feeOn === CollectFeeOn.FromInput) return zeroForOne;
    if (poolInfo.feeOn === CollectFeeOn.TokenOnlyA) return true;
    return false;
  }

  static isOverflowDefaultTickarrayBitmap({ tickSpacing, tickIndexs }: { tickSpacing: number; tickIndexs: number[] }) {
    const { maxTickBoundary, minTickBoundary } = this.tickArrayStartIndexRange({ tickSpacing });
    for (const tickIndex of tickIndexs) {
      const tickarrayStartIndex = TickArrayUtil.getTickArrayStartIndex(tickIndex, tickSpacing);

      if (tickarrayStartIndex >= maxTickBoundary || tickarrayStartIndex < minTickBoundary) {
        return true;
      }
    }

    return false;
  }

  static tickArrayStartIndexRange({ tickSpacing }: { tickSpacing: number }) {
    let maxTickBoundary = TickArrayBitmapUtil.maxTickInTickarrayBitmap(tickSpacing);
    let minTickBoundary = -maxTickBoundary;

    if (maxTickBoundary > MAX_TICK) {
      maxTickBoundary =
        TickArrayUtil.getTickArrayStartIndex(MAX_TICK, tickSpacing) + TickArrayUtil.tickCount(tickSpacing);
    }
    if (minTickBoundary < MIN_TICK) {
      minTickBoundary = TickArrayUtil.getTickArrayStartIndex(MIN_TICK, tickSpacing);
    }
    return { maxTickBoundary, minTickBoundary };
  }
}
