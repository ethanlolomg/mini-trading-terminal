import { useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import Jupiter from "@/lib/jupiter";
import { bn } from "@/lib/utils";
import { VersionedTransaction } from "@solana/web3.js";

export const useTrade = (
  tokenAddress: string,
) => {
  const createTransaction = useCallback(
    async (params: { direction: "buy" | "sell", atomicAmount: Decimal, signer: PublicKey }) => {
      const { direction, atomicAmount, signer } = params;

      // Get order from Jupiter
      const data = await Jupiter.getOrder({
        inputMint:
          direction === "buy" ? NATIVE_MINT : new PublicKey(tokenAddress),
        outputMint:
          direction === "buy" ? new PublicKey(tokenAddress) : NATIVE_MINT,
        amount: bn(atomicAmount),
        signer,
      });

      if (data.transaction === null) {
        throw new Error(
          `Invalid data from Jupiter.getOrder: ${JSON.stringify(data)}`,
        );
      }

      // Parse the transaction from base64
      const transactionBuffer = Buffer.from(data.transaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);


      return transaction;
    },
    [tokenAddress],
  );
  
  return {
    createTransaction,
  };
};