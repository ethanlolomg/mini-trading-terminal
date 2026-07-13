import type { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import type BN from "bn.js";

/** Supported swap routes. */
export type RouteId = "raydium-clmm" | "jupiter";

/**
 * Exact-in swap request handed to an adapter. `amount` is the atomic input
 * amount; `outputMint` is what the user receives.
 */
export interface SwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: BN;
  signer: PublicKey;
  connection: Connection;
  slippageBps?: number;
  /**
   * Compute-unit price (micro-lamports per CU) added as the transaction's
   * priority fee. Honored by `raydium-clmm`; Jupiter manages its own fee.
   */
  priorityFeeMicroLamports?: number;
  /** Required for `raydium-clmm`; ignored by Jupiter. */
  poolAddress?: string;
}

/**
 * A swap venue. Each adapter builds a ready-to-sign VersionedTransaction for an
 * exact-in swap.
 */
export interface SwapAdapter {
  readonly routeId: RouteId;
  buildSwapTx(params: SwapParams): Promise<VersionedTransaction>;
}

/** Result of route resolution: which venue + the pool to use (if any). */
export interface ResolvedRoute {
  routeId: RouteId;
  poolAddress?: string;
}

/**
 * Normalized pool metadata used to pick a route. Decoupled from the Codex SDK
 * shape so route resolution is easy to unit test; the FE maps Codex
 * `PairFilterResult` -> `PoolCandidate`.
 */
export interface PoolCandidate {
  exchangeName?: string | null;
  /** Exchange factory / program id (on Solana this is the AMM program id). */
  exchangeAddress?: string | null;
  poolAddress?: string | null;
  token0?: string | null;
  token1?: string | null;
  /** Present for UniswapV3-style (concentrated) pools, e.g. Raydium CLMM. */
  tickSpacing?: number | null;
}
