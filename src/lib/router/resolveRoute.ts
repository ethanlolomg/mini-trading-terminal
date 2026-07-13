import { NATIVE_MINT } from "@solana/spl-token";
import { RAYDIUM_CLMM_PROGRAM_ID } from "./adapters/raydiumClmm/constants";
import type { PoolCandidate, ResolvedRoute } from "./types";

const SOL_MINT = NATIVE_MINT.toBase58();
const CLMM_PROGRAM = RAYDIUM_CLMM_PROGRAM_ID.toBase58();

function isRaydiumClmm(c: PoolCandidate): boolean {
  // Most reliable: the exchange factory address is the CLMM program id.
  if (c.exchangeAddress && c.exchangeAddress === CLMM_PROGRAM) return true;
  const name = (c.exchangeName ?? "").toLowerCase();
  if (name.includes("raydium") && name.includes("clmm")) return true;
  // Raydium + concentrated liquidity (tickSpacing => UniswapV3-style pool).
  if (name.includes("raydium") && c.tickSpacing != null) return true;
  return false;
}

/**
 * Pick a route for swapping SOL <-> `tokenMint`.
 *
 * Uses Raydium CLMM only when a Raydium CLMM pool paired with SOL exists;
 * everything else falls back to Jupiter. `candidates` should be ordered by
 * preference (e.g. 24h volume desc) so the first match wins.
 */
export function resolveRoute(candidates: PoolCandidate[], tokenMint: string): ResolvedRoute {
  const match = candidates.find((c) => {
    if (!isRaydiumClmm(c)) return false;
    const hasSol = c.token0 === SOL_MINT || c.token1 === SOL_MINT;
    const hasToken = c.token0 === tokenMint || c.token1 === tokenMint;
    return hasSol && hasToken && !!c.poolAddress;
  });

  if (match?.poolAddress) {
    return { routeId: "raydium-clmm", poolAddress: match.poolAddress };
  }
  return { routeId: "jupiter" };
}
