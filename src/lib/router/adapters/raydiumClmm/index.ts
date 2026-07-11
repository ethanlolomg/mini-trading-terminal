import { VersionedTransaction } from "@solana/web3.js";
import type { SwapAdapter, SwapParams } from "../../types";

/**
 * Raydium CLMM adapter (in-house swap_v2).
 *
 * The router routes SOL<->token swaps here whenever a Raydium CLMM pool with SOL
 * exists. The exact-in transaction builder (read pool via Helius ->
 * clmmSwapMath.swapExactIn -> build swap_v2 VersionedTransaction) is implemented
 * in the following phases; until then this throws so the missing piece is
 * obvious.
 */
export const raydiumClmmAdapter: SwapAdapter = {
  routeId: "raydium-clmm",

  async buildSwapTx(_params: SwapParams): Promise<VersionedTransaction> {
    throw new Error("Raydium CLMM swap_v2 builder not implemented yet");
  },
};
