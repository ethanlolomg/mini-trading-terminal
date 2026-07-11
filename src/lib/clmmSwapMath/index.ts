/**
 * clmmSwapMath — pure, reusable Raydium CLMM swap math.
 *
 * No app/RPC dependencies (BN/Decimal only). Adapted from Raydium SDK V2
 * (Apache-2.0); see per-file headers for attribution.
 *
 * Phase 1 surface: the swap engine + primitives. Phase 4 adds the thin
 * `swapExactIn` / `swapExactOut` wrappers as the public API.
 */
export * from "./constants";
export * from "./fixedPoint";
export * from "./sqrtPriceMath";
export * from "./liquidityMath";
export * from "./poolFee";
export * from "./tickMath";
export * from "./swapStep";
export { swapInternal } from "./swapSimulator";
export type { SwapSimulationResult } from "./swapSimulator";
export { swapExactIn } from "./swap";
export type { SwapExactInParams, SwapExactInResult } from "./swap";
export type {
  PoolInfoDecoded,
  ClmmConfigDecoded,
  TickDecoded,
  TickArrayDecoded,
  TickArrayBitmapExtensionDecoded,
  PublicKeyLike,
} from "./types";
