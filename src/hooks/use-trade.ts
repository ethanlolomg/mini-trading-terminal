import { useCallback } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import { bn } from "@/lib/utils";
import { createConnection } from "@/lib/solana";
import { buildSwapTx, type ResolvedRoute } from "@/lib/router";

export const useTrade = (
  tokenAddress: string,
  tokenAtomicBalance: Decimal,
  route: ResolvedRoute,
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

      const inputMint =
        direction === "buy" ? NATIVE_MINT : new PublicKey(tokenAddress);
      const outputMint =
        direction === "buy" ? new PublicKey(tokenAddress) : NATIVE_MINT;

      const connection = createConnection();

      // Dispatch to the resolved venue (Raydium CLMM or Jupiter) via the router.
      const transaction = await buildSwapTx(route.routeId, {
        inputMint,
        outputMint,
        amount: bn(atomicAmount),
        signer,
        connection,
        poolAddress: route.poolAddress,
      });

      return transaction;
    },
    [tokenAddress, tokenAtomicBalance, route.routeId, route.poolAddress],
  );

  return {
    createTransaction,
  };
};
