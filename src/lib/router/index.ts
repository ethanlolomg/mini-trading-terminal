import type { VersionedTransaction } from "@solana/web3.js";
import { getAdapter } from "./registry";
import type { RouteId, SwapParams } from "./types";

/** Build an exact-in swap transaction via the adapter for `routeId`. */
export function buildSwapTx(routeId: RouteId, params: SwapParams): Promise<VersionedTransaction> {
  return getAdapter(routeId).buildSwapTx(params);
}

export { getAdapter } from "./registry";
export { resolveRoute } from "./resolveRoute";
export type { RouteId, SwapAdapter, SwapParams, ResolvedRoute, PoolCandidate } from "./types";
