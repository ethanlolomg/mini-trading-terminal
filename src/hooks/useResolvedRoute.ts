import { useMemo } from "react";
import type { PairFilterResult } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { resolveRoute, type PoolCandidate, type ResolvedRoute } from "@/lib/router";

/**
 * Map the token's Codex pairs to normalized `PoolCandidate`s and resolve the
 * swap venue (Raydium CLMM when a CLMM+SOL pool exists, else Jupiter). Memoized
 * on the pairs + token so the route is stable across renders. Shared by the
 * in-column and floating trade panels.
 */
export function useResolvedRoute(tokenAddress: string, pairs: PairFilterResult[]): ResolvedRoute {
  return useMemo(() => {
    const candidates: PoolCandidate[] = pairs.map((p) => ({
      exchangeName: p.exchange?.name,
      exchangeAddress: p.exchange?.address,
      poolAddress: p.pair?.address,
      token0: p.pair?.token0,
      token1: p.pair?.token1,
      tickSpacing: p.pair?.tickSpacing,
    }));
    return resolveRoute(candidates, tokenAddress);
  }, [pairs, tokenAddress]);
}
