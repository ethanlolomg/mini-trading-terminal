import { VersionedTransaction } from "@solana/web3.js";
import type { SwapAdapter, SwapParams } from "../../types";
import { buildRaydiumClmmSwapTx } from "./buildSwapTx";

/**
 * Raydium CLMM adapter (in-house swap_v2). The router routes SOL<->token swaps
 * here whenever a Raydium CLMM pool with SOL exists. Reads pool state via Helius,
 * runs the in-house swap simulation, and builds a swap_v2 VersionedTransaction.
 */
export const raydiumClmmAdapter: SwapAdapter = {
  routeId: "raydium-clmm",

  async buildSwapTx(params: SwapParams): Promise<VersionedTransaction> {
    return buildRaydiumClmmSwapTx(params);
  },
};
