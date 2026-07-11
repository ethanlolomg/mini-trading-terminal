import { describe, expect, it } from "vitest";
import { NATIVE_MINT } from "@solana/spl-token";
import { getAdapter } from "./registry";
import { resolveRoute } from "./resolveRoute";
import { RAYDIUM_CLMM_PROGRAM_ID } from "./adapters/raydiumClmm/constants";
import type { PoolCandidate, RouteId } from "./types";

const SOL = NATIVE_MINT.toBase58();
const TRUMP = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN";
const POOL = "PooLaddr1111111111111111111111111111111111";

describe("registry.getAdapter", () => {
  it("returns the adapter for known route ids", () => {
    expect(getAdapter("jupiter").routeId).toBe("jupiter");
    expect(getAdapter("raydium-clmm").routeId).toBe("raydium-clmm");
  });

  it("throws for an unknown route id", () => {
    expect(() => getAdapter("uniswap" as RouteId)).toThrow(/unknown route_id/i);
  });
});

describe("resolveRoute", () => {
  it("routes to raydium-clmm when a Raydium CLMM + SOL pool exists (by program id)", () => {
    const candidates: PoolCandidate[] = [
      {
        exchangeName: "Raydium CLMM",
        exchangeAddress: RAYDIUM_CLMM_PROGRAM_ID.toBase58(),
        poolAddress: POOL,
        token0: TRUMP,
        token1: SOL,
        tickSpacing: 10,
      },
    ];
    expect(resolveRoute(candidates, TRUMP)).toEqual({ routeId: "raydium-clmm", poolAddress: POOL });
  });

  it("detects CLMM via raydium name + tickSpacing when program id absent", () => {
    const candidates: PoolCandidate[] = [
      { exchangeName: "Raydium", poolAddress: POOL, token0: SOL, token1: TRUMP, tickSpacing: 60 },
    ];
    expect(resolveRoute(candidates, TRUMP)).toEqual({ routeId: "raydium-clmm", poolAddress: POOL });
  });

  it("falls back to jupiter when the raydium pool is not paired with SOL", () => {
    const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const candidates: PoolCandidate[] = [
      { exchangeName: "Raydium CLMM", poolAddress: POOL, token0: TRUMP, token1: usdc, tickSpacing: 10 },
    ];
    expect(resolveRoute(candidates, TRUMP)).toEqual({ routeId: "jupiter" });
  });

  it("falls back to jupiter for non-CLMM raydium pools (no tickSpacing)", () => {
    const candidates: PoolCandidate[] = [
      { exchangeName: "Raydium", poolAddress: POOL, token0: SOL, token1: TRUMP, tickSpacing: null },
    ];
    expect(resolveRoute(candidates, TRUMP)).toEqual({ routeId: "jupiter" });
  });

  it("falls back to jupiter when there are no pools", () => {
    expect(resolveRoute([], TRUMP)).toEqual({ routeId: "jupiter" });
  });
});
