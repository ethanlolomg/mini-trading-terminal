import { VersionedTransaction } from "@solana/web3.js";
import Jupiter from "./client";
import type { SwapAdapter, SwapParams } from "../../types";

/**
 * Jupiter adapter — wraps the Jupiter Ultra flow (fetch order, deserialize the
 * returned base64 VersionedTransaction). This is the fallback venue for any
 * token without a Raydium CLMM + SOL pool.
 */
export const jupiterAdapter: SwapAdapter = {
  routeId: "jupiter",

  async buildSwapTx({ inputMint, outputMint, amount, signer }: SwapParams): Promise<VersionedTransaction> {
    const data = await Jupiter.getOrder({ inputMint, outputMint, amount, signer });

    if (data.error) {
      throw new Error(data.error);
    }
    if (data.transaction === null) {
      throw new Error("Invalid data from Jupiter.getOrder");
    }

    const transactionBuffer = Buffer.from(data.transaction, "base64");
    return VersionedTransaction.deserialize(transactionBuffer);
  },
};
