/**
 * clmmSwapMath — pure, reusable Raydium CLMM exact-in swap math.
 *
 * No app/RPC dependencies (BN only). Adapted from Raydium SDK V2 (Apache-2.0),
 * trimmed to the exact-in swap path. `swapExactIn` is the public entry point;
 * `math.ts` holds the supporting primitives.
 */
export * from "./math";
export * from "./swap";
export type {
  PoolInfoDecoded,
  ClmmConfigDecoded,
  TickDecoded,
  TickArrayDecoded,
  TickArrayBitmapExtensionDecoded,
  PublicKeyLike,
} from "./types";
