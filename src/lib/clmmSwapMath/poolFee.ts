/**
 * Raydium CLMM swap math — pool fee helpers.
 *
 * Adapted from Raydium SDK V2 (src/raydium/clmm/libraries/pool.ts, lines
 * 17-226), Apache-2.0. https://github.com/raydium-io/raydium-sdk-V2
 *
 * Only the stateless PoolUtil helpers are kept. The heavy PoolUtils methods that
 * need RPC (`@/common`), `@/api`, `@/module` are intentionally left behind — thin
 * in-house exact-in/out wrappers are provided instead.
 *
 * Edits vs upstream: layout `ReturnType<...>` types repointed to ./types and
 * tick utils repointed to ./tickMath.
 */
import { TickArrayBitmapUtil, TickArrayUtil } from "./tickMath";
import { MAX_TICK, MIN_TICK, CollectFeeOn } from "./constants";
import type { PoolInfoDecoded } from "./types";

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
