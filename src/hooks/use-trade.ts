import { useCallback } from "react";
import { toast } from "sonner";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import { bn } from "@/lib/utils";
import {
  confirmTransaction,
  createConnection,
  createKeypair,
  getPriorityFeeEstimate,
  sendTransaction,
  signTransaction,
} from "@/lib/solana";
import { buildSwapTx, type ResolvedRoute } from "@/lib/router";
import type { PriorityFee } from "@/stores/instantTradeStore";

interface CreateTransactionParams {
  direction: "buy" | "sell";
  value: number;
  signer: PublicKey;
  slippageBps?: number;
  priorityFeeMicroLamports?: number;
}

interface ExecuteTradeParams {
  direction: "buy" | "sell";
  value: number;
  slippageBps: number;
  priorityFee: PriorityFee;
  /** Called after a confirmed trade (e.g. to refresh balances). */
  onSuccess?: () => void;
}

export const useTrade = (
  tokenAddress: string,
  tokenAtomicBalance: Decimal,
  route: ResolvedRoute,
) => {
  const createTransaction = useCallback(
    async (params: CreateTransactionParams) => {
      const { direction, value, signer, slippageBps, priorityFeeMicroLamports } = params;

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
        slippageBps,
        priorityFeeMicroLamports,
      });

      return transaction;
    },
    [tokenAddress, tokenAtomicBalance, route.routeId, route.poolAddress],
  );

  /**
   * End-to-end trade: resolve the priority fee, build → sign → send → confirm,
   * surfacing progress via toasts. Shared by the in-column and floating panels.
   */
  const executeTrade = useCallback(
    async ({ direction, value, slippageBps, priorityFee, onSuccess }: ExecuteTradeParams) => {
      const toastId = toast.loading("Submitting trade request...");
      try {
        const keypair = createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
        const connection = createConnection();

        const priorityFeeMicroLamports =
          priorityFee.mode === "fixed"
            ? priorityFee.microLamports
            : await getPriorityFeeEstimate(connection);

        const transaction = await createTransaction({
          direction,
          value,
          signer: keypair.publicKey,
          slippageBps,
          priorityFeeMicroLamports,
        });

        toast.loading("Signing transaction...", { id: toastId });
        const signedTransaction = signTransaction(keypair, transaction);

        toast.loading("Sending transaction...", { id: toastId });
        const signature = await sendTransaction(signedTransaction, connection);

        toast.loading("Confirming transaction...", { id: toastId });
        const confirmation = await confirmTransaction(signature, connection);

        if (confirmation.value.err) {
          throw new Error("Trade failed");
        }

        toast.success(`Trade successful! TX: ${signature.slice(0, 8)}...`, {
          id: toastId,
          action: {
            label: "Solscan",
            onClick: () => window.open(`https://solscan.io/tx/${signature}`, "_blank"),
          },
        });
        onSuccess?.();
      } catch (error) {
        toast.error((error as Error).message, { id: toastId });
      }
    },
    [createTransaction],
  );

  return {
    createTransaction,
    executeTrade,
  };
};
