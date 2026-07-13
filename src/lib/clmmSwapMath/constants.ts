/**
 * Raydium CLMM swap math — constants.
 *
 * Adapted from Raydium SDK V2 (src/raydium/clmm/libraries/constants.ts),
 * Apache-2.0. https://github.com/raydium-io/raydium-sdk-V2
 *
 * Trimmed to the constants the in-house swap path actually uses.
 * `FEE_RATE_DENOMINATOR_VALUE` is defined here (upstream exposes it from
 * `@/common`) so this math package stays free of app deps.
 */
import BN from "bn.js";

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
