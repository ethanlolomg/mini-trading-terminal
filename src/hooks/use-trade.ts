import { useCallback } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import Jupiter from "@/lib/jupiter";
import { bn } from "@/lib/utils";
import { VersionedTransaction } from "@solana/web3.js";

export const useTrade = (
  tokenAddress: string,
  tokenAtomicBalance: Decimal,
) => {
  const createTransaction = useCallback(
    async (params: { direction: "buy" | "sell", value: number, signer: PublicKey }) => {
      const { direction, value, signer } = params;

      let atomicAmount;
      if (direction === "buy") {
        atomicAmount = new Decimal(value).mul(LAMPORTS_PER_SOL);
      } else {
        atomicAmount = tokenAtomicBalance.mul(value).div(100);
      }

      // Get order from Jupiter
      const data = await Jupiter.getOrder({
        inputMint:
          direction === "buy" ? NATIVE_MINT : new PublicKey(tokenAddress),
        outputMint:
          direction === "buy" ? new PublicKey(tokenAddress) : NATIVE_MINT,
        amount: bn(atomicAmount),
        signer,
      });

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.transaction === null) {
        throw new Error("Invalid data from Jupiter.getOrder");
      }

      // Parse the transaction from base64
      const transactionBuffer = Buffer.from(data.transaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);


      return transaction;
    },
    [tokenAddress, tokenAtomicBalance],
  );
  
  return {
    createTransaction,
  };
};