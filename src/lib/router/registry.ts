import { jupiterAdapter } from "./adapters/jupiter";
import { raydiumClmmAdapter } from "./adapters/raydiumClmm";
import type { RouteId, SwapAdapter } from "./types";

const registry: Record<RouteId, SwapAdapter> = {
  jupiter: jupiterAdapter,
  "raydium-clmm": raydiumClmmAdapter,
};

/** Resolve a route_id to its adapter; throws on unknown ids. */
export function getAdapter(routeId: RouteId): SwapAdapter {
  const adapter = registry[routeId];
  if (!adapter) {
    throw new Error(`Unknown route_id: ${routeId}`);
  }
  return adapter;
}
