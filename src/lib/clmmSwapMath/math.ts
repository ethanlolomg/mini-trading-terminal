/**
 * clmmSwapMath — pure Raydium CLMM math primitives (no app/RPC deps).
 *
 * Adapted from Raydium SDK V2 (Apache-2.0), trimmed to the exact-in swap path:
 * constants, fixed-point helpers, sqrt-price / liquidity / tick math.
 * https://github.com/raydium-io/raydium-sdk-V2
 */
import BN from "bn.js";
import type { PoolInfoDecoded, TickArrayBitmapExtensionDecoded, TickArrayDecoded, TickDecoded } from "./types";

// ===================== constants =====================
export const Q64 = new BN(1).shln(64);

export const RESOLUTION = 64;

export const U64_MAX = new BN(1).shln(64).subn(1);

export const MIN_TICK = -443636;

export const MAX_TICK = 443636;

export const MIN_SQRT_PRICE_X64 = new BN("4295048016");

export const MAX_SQRT_PRICE_X64 = new BN("79226673521066979257578248091");

export const LOG_B_2_X32 = new BN("59543866431248");

export const LOG_B_P_ERR_MARGIN_LOWER_X64 = new BN("184467440737095516");

export const LOG_B_P_ERR_MARGIN_UPPER_X64 = new BN("15793534762490258745");

export const BIT_PRECISION = 16;

export const TICK_ARRAY_BITMAP_SIZE = 512;

export const TICK_ARRAY_SIZE = 60;

export const TICK_TO_SQRT_PRICE_FACTORS: { bit: number; factor: BN }[] = [
  { bit: 0, factor: new BN("fffcb933bd6fb800", 16) }, // i=0
  { bit: 1, factor: new BN("fff97272373d4000", 16) }, // i=1
  { bit: 2, factor: new BN("fff2e50f5f657000", 16) }, // i=2
  { bit: 3, factor: new BN("ffe5caca7e10f000", 16) }, // i=3
  { bit: 4, factor: new BN("ffcb9843d60f7000", 16) }, // i=4
  { bit: 5, factor: new BN("ff973b41fa98e800", 16) }, // i=5
  { bit: 6, factor: new BN("ff2ea16466c9b000", 16) }, // i=6
  { bit: 7, factor: new BN("fe5dee046a9a3800", 16) }, // i=7
  { bit: 8, factor: new BN("fcbe86c7900bb000", 16) }, // i=8
  { bit: 9, factor: new BN("f987a7253ac65800", 16) }, // i=9
  { bit: 10, factor: new BN("f3392b0822bb6000", 16) }, // i=10
  { bit: 11, factor: new BN("e7159475a2caf000", 16) }, // i=11
  { bit: 12, factor: new BN("d097f3bdfd2f2000", 16) }, // i=12
  { bit: 13, factor: new BN("a9f746462d9f8000", 16) }, // i=13
  { bit: 14, factor: new BN("70d869a156f31c00", 16) }, // i=14
  { bit: 15, factor: new BN("31be135f97ed3200", 16) }, // i=15
  { bit: 16, factor: new BN("9aa508b5b85a500", 16) }, // i=16
  { bit: 17, factor: new BN("5d6af8dedc582c", 16) }, // i=17
  { bit: 18, factor: new BN("2216e584f5fa", 16) }, // i=18
];

export const FEE_RATE_DENOMINATOR = 1_000_000;

// Upstream exports this from `@/common`; kept local to avoid app-layer deps.
export const FEE_RATE_DENOMINATOR_VALUE = new BN(1_000_000);

export enum CollectFeeOn {
  FromInput = 0,
  TokenOnlyA = 1,
  TokenOnlyB = 2,
}

export const REWARD_NUM = 3;

export const EXTENSION_TICKARRAY_BITMAP_SIZE = 14;

export const BN_ZERO = new BN(0);
export const BN_ONE = new BN(1);

// ===================== fixed-point primitives =====================
export function mulDivFloor(a: BN, b: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    throw new Error("Division by zero")
  }
  return a.mul(b).div(denominator)
}

export function mulDivCeil(a: BN, b: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    throw new Error("Division by zero")
  }
  const product = a.mul(b)
  const quotient = product.div(denominator)
  const remainder = product.mod(denominator)

  if (remainder.isZero()) {
    return quotient
  }
  return quotient.addn(1)
}

export function divRoundingUp(x: BN, y: BN) {
  return x.div(y).add(x.mod(y).isZero() ? BN_ZERO : BN_ONE)
}

export function mostSignificantBit(n: BN): number {
  if (n.isZero()) {
    return -1
  }
  return n.bitLength() - 1
}

// ===================== sqrt-price math =====================
export class SqrtPriceMath {
  /** Token A (token0) added → price falls. √P_new = L·√P / (L + Δx·√P). */
  static getNextSqrtPriceFromAmountARoundingUp(sqrtPriceX64: BN, liquidity: BN, amount: BN): BN {
    if (amount.isZero()) {
      return sqrtPriceX64
    }

    const numerator = liquidity.shln(RESOLUTION)
    const product = amount.mul(sqrtPriceX64)
    const denominator = numerator.add(product)

    if (denominator.gte(numerator)) {
      return mulDivCeil(numerator, sqrtPriceX64, denominator)
    }

    const quotient = mulDivFloor(numerator, BN_ONE, sqrtPriceX64)
    return mulDivCeil(numerator, BN_ONE, quotient.add(amount))
  }

  /** Token B (token1) added → price rises. √P_new = √P + Δy / L. */
  static getNextSqrtPriceFromAmountBRoundingDown(sqrtPriceX64: BN, liquidity: BN, amount: BN): BN {
    if (amount.isZero()) {
      return sqrtPriceX64
    }

    const quotient = amount.shln(RESOLUTION).div(liquidity)
    return sqrtPriceX64.add(quotient)
  }

  static getNextSqrtPriceFromInput(
    sqrtPriceX64: BN,
    liquidity: BN,
    amountIn: BN,
    zeroForOne: boolean
  ): BN {
    if (!sqrtPriceX64.gt(BN_ZERO)) throw Error('sqrtPriceX64.gt(BN_ZERO)')
    if (!liquidity.gt(BN_ZERO)) throw Error('liquidity.gt(BN_ZERO)')

    if (zeroForOne) {
      return this.getNextSqrtPriceFromAmountARoundingUp(sqrtPriceX64, liquidity, amountIn)
    } else {
      return this.getNextSqrtPriceFromAmountBRoundingDown(sqrtPriceX64, liquidity, amountIn)
    }
  }
}

// ===================== liquidity math =====================
export class LiquidityMathUtil {
  static getDeltaAmountAUnsigned(sqrtPriceX64A: BN, sqrtPriceX64B: BN, liquidity: BN, roundUp: boolean): BN {
    if (sqrtPriceX64A.gt(sqrtPriceX64B)) {
      [sqrtPriceX64A, sqrtPriceX64B] = [sqrtPriceX64B, sqrtPriceX64A];
    }

    const numerator1 = liquidity.shln(RESOLUTION);
    const numerator2 = sqrtPriceX64B.sub(sqrtPriceX64A);

    if (!sqrtPriceX64A.gt(BN_ZERO)) throw Error("!sqrtPriceX64A.gt(BN_ZERO)");

    const result = roundUp
      ? divRoundingUp(mulDivCeil(numerator1, numerator2, sqrtPriceX64B), sqrtPriceX64A)
      : mulDivFloor(numerator1, numerator2, sqrtPriceX64B).div(sqrtPriceX64A);

    if (result.gt(U64_MAX)) throw Error("MaxTokenOverflow");

    return result;
  }

  static getDeltaAmountBUnsigned(sqrtPriceX64A: BN, sqrtPriceX64B: BN, liquidity: BN, roundUp: boolean): BN {
    if (sqrtPriceX64A.gt(sqrtPriceX64B)) {
      [sqrtPriceX64A, sqrtPriceX64B] = [sqrtPriceX64B, sqrtPriceX64A];
    }

    const result = roundUp
      ? mulDivCeil(liquidity, sqrtPriceX64B.sub(sqrtPriceX64A), Q64)
      : mulDivFloor(liquidity, sqrtPriceX64B.sub(sqrtPriceX64A), Q64);

    if (result.gt(U64_MAX)) throw Error("MaxTokenOverflow");

    return result;
  }

  static addDelta(x: BN, y: BN): BN {
    if (y.isNeg()) {
      const absY = y.neg();
      if (x.lt(absY)) {
        throw new Error("Liquidity underflow");
      }
      return x.sub(absY);
    } else {
      return x.add(y);
    }
  }
}

// ===================== tick / tick-array math =====================
export class TickArrayBitmapUtil {
  private static scanLinearBitmap({
    bitmap,
    tickSpacing,
    offset,
    checkInfo,
  }: {
    bitmap: Buffer;
    tickSpacing: number;
    offset: number;
    checkInfo?: { tick: number; valueType: "lte" | "gte" };
  }): number[] {
    const result: number[] = [];
    const totalBits = bitmap.length * 8;

    let startBit = 0;
    let endBit = totalBits - 1;

    if (checkInfo) {
      const threshold = checkInfo.tick / (tickSpacing * TICK_ARRAY_SIZE) - offset;
      if (checkInfo.valueType === "gte") {
        startBit = Math.max(0, Math.ceil(threshold));
      } else {
        endBit = Math.min(totalBits - 1, Math.floor(threshold));
      }
    }

    if (startBit > endBit) return result;

    const startByte = Math.floor(startBit / 8);
    const endByte = Math.floor(endBit / 8);

    for (let i = startByte; i <= endByte; i++) {
      if (!bitmap[i]) continue;

      const jStart = i === startByte ? startBit % 8 : 0;
      const jEnd = i === endByte ? endBit % 8 : 7;
      for (let j = jStart; j <= jEnd; j++) {
        if (bitmap[i] & (1 << j)) {
          result.push((i * 8 + j + offset) * tickSpacing * TICK_ARRAY_SIZE);
        }
      }
    }
    return result;
  }

  private static findPoolBitmap({
    bitmap,
    tickSpacing,
    checkInfo,
  }: {
    bitmap: Buffer;
    tickSpacing: number;
    checkInfo?: { tick: number; valueType: "lte" | "gte" };
  }): number[] {
    if (checkInfo) {
      const _i = Math.floor(checkInfo.tick / TICK_ARRAY_SIZE / tickSpacing);
      if (checkInfo.valueType === "lte" && _i < -512) return [];
      if (checkInfo.valueType === "gte" && _i > 512) return [];
    }
    return this.scanLinearBitmap({ bitmap, tickSpacing, offset: -TICK_ARRAY_BITMAP_SIZE, checkInfo });
  }

  private static findPositiveTickArrayBitmap({
    bitmap,
    tickSpacing,
    checkInfo,
  }: {
    bitmap: Buffer;
    tickSpacing: number;
    checkInfo?: { tick: number; valueType: "lte" | "gte" };
  }): number[] {
    if (checkInfo) {
      const _i = Math.floor(checkInfo.tick / TICK_ARRAY_SIZE / tickSpacing);
      if (checkInfo.valueType === "lte" && _i < 512) return [];
    }
    return this.scanLinearBitmap({ bitmap, tickSpacing, offset: TICK_ARRAY_BITMAP_SIZE, checkInfo });
  }

  private static findNegativeTickArrayBitmap({
    bitmap,
    tickSpacing,
    count,
    checkInfo,
  }: {
    bitmap: Buffer;
    tickSpacing: number;
    count?: number;
    checkInfo?: { tick: number; valueType: "lte" | "gte" };
  }): number[] {
    const result: number[] = [];

    if (checkInfo) {
      const _i = Math.floor(checkInfo.tick / TICK_ARRAY_SIZE / tickSpacing);
      if (checkInfo.valueType === "gte" && _i >= -512) return result;
    }

    const maxFlatIndex =
      checkInfo?.valueType === "lte" ? Math.floor(checkInfo.tick / (TICK_ARRAY_SIZE * tickSpacing)) + 7680 : Infinity;
    const minFlatIndex =
      checkInfo?.valueType === "gte" ? Math.ceil(checkInfo.tick / (TICK_ARRAY_SIZE * tickSpacing)) + 7680 : 0;

    outer: for (let arrayIndex = 0; arrayIndex < EXTENSION_TICKARRAY_BITMAP_SIZE; arrayIndex++) {
      const reversedIndex = EXTENSION_TICKARRAY_BITMAP_SIZE - 1 - arrayIndex;
      for (let searchIndex = 0; searchIndex < 512; searchIndex++) {
        const flatIndex = arrayIndex * 512 + searchIndex;

        if (flatIndex > maxFlatIndex) break outer;
        if (flatIndex < minFlatIndex) continue;

        const byteOffset = reversedIndex * 64 + Math.floor(searchIndex / 8);
        if (!bitmap[byteOffset]) {
          searchIndex = Math.floor(searchIndex / 8) * 8 + 7;
          continue;
        }
        if (bitmap[byteOffset] & (1 << searchIndex % 8)) {
          const tick = (arrayIndex * 512 + searchIndex - 7680) * TICK_ARRAY_SIZE * tickSpacing;
          result.push(tick);

          if (count !== undefined && result.length >= count) break outer;
        }
      }
    }
    return result;
  }

  static findTickArrayStartIndex({
    tickSpacing,
    poolBitmap,
    tickArrayBitmap,
    findInfo,
  }: {
    tickSpacing: number;
    poolBitmap: PoolInfoDecoded["tickArrayBitmap"];
    tickArrayBitmap: TickArrayBitmapExtensionDecoded;
    findInfo: { type: "zeroForOne" | "oneForZero"; count?: number; tickArrayCurrent: number } | { type: "all" };
  }): number[] {
    if (findInfo.type === "all") {
      return [
        ...this.findNegativeTickArrayBitmap({ tickSpacing, bitmap: tickArrayBitmap.negativeTickArrayBitmap }),
        ...this.findPoolBitmap({ tickSpacing, bitmap: poolBitmap }),
        ...this.findPositiveTickArrayBitmap({ tickSpacing, bitmap: tickArrayBitmap.positiveTickArrayBitmap }),
      ];
    }

    const tickStart = TickArrayUtil.getTickArrayStartIndex(findInfo.tickArrayCurrent, tickSpacing);
    const { count } = findInfo;

    if (findInfo.type === "oneForZero") {
      const checkInfo = { tick: tickStart, valueType: "gte" } as const;
      const finders = [
        () =>
          this.findNegativeTickArrayBitmap({ tickSpacing, bitmap: tickArrayBitmap.negativeTickArrayBitmap, checkInfo }),
        () => this.findPoolBitmap({ tickSpacing, bitmap: poolBitmap, checkInfo }),
        () =>
          this.findPositiveTickArrayBitmap({ tickSpacing, bitmap: tickArrayBitmap.positiveTickArrayBitmap, checkInfo }),
      ];
      return this.collectUntil(finders, count);
    }

    if (findInfo.type === "zeroForOne") {
      const checkInfo = { tick: tickStart, valueType: "lte" } as const;
      const finders = [
        () =>
          this.findPositiveTickArrayBitmap({
            tickSpacing,
            bitmap: tickArrayBitmap.positiveTickArrayBitmap,
            checkInfo,
          }).sort((a, b) => b - a),
        () => this.findPoolBitmap({ tickSpacing, bitmap: poolBitmap, checkInfo }).sort((a, b) => b - a),
        () =>
          this.findNegativeTickArrayBitmap({
            tickSpacing,
            bitmap: tickArrayBitmap.negativeTickArrayBitmap,
            checkInfo,
          }).sort((a, b) => b - a),
      ];
      return this.collectUntil(finders, count);
    }

    throw new Error("find info type check error");
  }

  private static collectUntil(finders: Array<() => number[]>, count: number | undefined): number[] {
    const collected: number[] = [];
    for (const finder of finders) {
      if (count !== undefined && collected.length >= count) break;
      collected.push(...finder());
    }
    return collected.slice(0, count);
  }
}

export class TickArrayUtil {
  static firstinitializedTick({
    data,
    zeroForOne,
  }: {
    data: TickArrayDecoded;
    zeroForOne: boolean;
  }) {
    if (zeroForOne) {
      for (let i = data.ticks.length - 1; i >= 0; i--) {
        if (TickUtil.isInitialized({ data: data.ticks[i] })) return data.ticks[i];
      }
    } else {
      for (let i = 0; i < data.ticks.length; i++) {
        if (TickUtil.isInitialized({ data: data.ticks[i] })) return data.ticks[i];
      }
    }
  }

  static nextInitalizedTick({
    data,
    currentTickIndex,
    tickSpacing,
    zeroForOne,
  }: {
    data: TickArrayDecoded;
    currentTickIndex: number;
    tickSpacing: number;
    zeroForOne: boolean;
  }) {
    const currentTickArrayStartIndex = this.getTickArrayStartIndex(currentTickIndex, tickSpacing);
    if (currentTickArrayStartIndex !== data.startTickIndex) return undefined;
    const offsetInArray = Math.floor((currentTickIndex - data.startTickIndex) / tickSpacing);

    if (zeroForOne) {
      for (let i = offsetInArray; i >= 0; i--) {
        if (TickUtil.isInitialized({ data: data.ticks[i] })) {
          return data.ticks[i];
        }
      }
    } else {
      for (let i = offsetInArray + 1; i < TICK_ARRAY_SIZE; i++) {
        if (TickUtil.isInitialized({ data: data.ticks[i] })) {
          return data.ticks[i];
        }
      }
    }
    return undefined;
  }

  static getTickArrayStartIndex(tickIndex: number, tickSpacing: number) {
    const ticksInArray = this.tickCount(tickSpacing);
    const start = Math.floor(tickIndex / ticksInArray);

    return start * ticksInArray;
  }

  static tickCount(tickSpacing: number) {
    return TICK_ARRAY_SIZE * tickSpacing;
  }
}

export class TickUtil {
  static isInitialized({ data }: { data: TickDecoded }): boolean {
    return !data.liquidityGross.isZero();
  }

  static isValidTick(tick: number): boolean {
    return tick >= MIN_TICK && tick <= MAX_TICK;
  }
  static checkTick(tick: number): void {
    if (!this.isValidTick(tick)) {
      throw new Error(`Tick ${tick} is out of range [${MIN_TICK}, ${MAX_TICK}]`);
    }
  }
  static getSqrtPriceAtTick(tick: number): BN {
    this.checkTick(tick);

    const absTick = Math.abs(tick);

    let ratio = Q64.clone();

    for (const { bit, factor } of TICK_TO_SQRT_PRICE_FACTORS) {
      if ((absTick & (1 << bit)) !== 0) {
        ratio = mulDivFloor(ratio, factor, Q64);
      }
    }

    if (tick > 0) {
      ratio = mulDivFloor(Q64, Q64, ratio);
    }

    return ratio;
  }

  static getTickAtSqrtPrice(sqrtPriceX64: BN): number {
    if (!(sqrtPriceX64.gte(MIN_SQRT_PRICE_X64) && sqrtPriceX64.lte(MAX_SQRT_PRICE_X64))) throw Error("SqrtPriceX64");

    const msb = mostSignificantBit(sqrtPriceX64);

    const msbMinus64 = msb - 64;
    let log2pIntegerX32: BN;
    if (msbMinus64 >= 0) {
      log2pIntegerX32 = new BN(msbMinus64).shln(32);
    } else {
      log2pIntegerX32 = new BN(-msbMinus64).shln(32).neg();
    }

    let r: BN;
    if (msb >= 64) {
      r = sqrtPriceX64.shrn(msb - 63);
    } else {
      r = sqrtPriceX64.shln(63 - msb);
    }

    let log2pFractionX64 = new BN(0);
    let bit = new BN(1).shln(63);

    for (let precision = 0; precision < BIT_PRECISION && !bit.isZero(); precision++) {
      r = r.mul(r);

      const isRMoreThanTwo = r.shrn(127).toNumber();

      r = r.shrn(63 + isRMoreThanTwo);

      if (isRMoreThanTwo) {
        log2pFractionX64 = log2pFractionX64.add(bit);
      }

      bit = bit.shrn(1);
    }

    const log2pFractionX32 = log2pFractionX64.shrn(32);
    const log2pX32 = log2pIntegerX32.add(log2pFractionX32);

    const logSqrt10001X64 = log2pX32.mul(LOG_B_2_X32);

    const tickLowBN = logSqrt10001X64.sub(LOG_B_P_ERR_MARGIN_LOWER_X64);
    const tickHighBN = logSqrt10001X64.add(LOG_B_P_ERR_MARGIN_UPPER_X64);

    const tickLow = this.signedShrn64(tickLowBN);
    const tickHigh = this.signedShrn64(tickHighBN);

    if (tickLow === tickHigh) {
      return tickLow;
    }

    const sqrtPriceAtTickHigh = TickUtil.getSqrtPriceAtTick(tickHigh);
    if (sqrtPriceAtTickHigh.lte(sqrtPriceX64)) {
      return tickHigh;
    }

    return tickLow;
  }

  private static signedShrn64(bn: BN): number {
    if (bn.isNeg()) {
      const Q64Local = new BN(1).shln(64);
      const result = bn.div(Q64Local);
      if (!bn.mod(Q64Local).isZero() && bn.isNeg()) {
        return result.subn(1).toNumber();
      }
      return result.toNumber();
    } else {
      return bn.shrn(64).toNumber();
    }
  }

}
