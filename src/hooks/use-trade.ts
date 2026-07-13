import { useCallback } from "react";
import { toast } from "sonner";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
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
  connection: Connection;
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

/** True when every env var required to build and submit a trade is configured. */
const envReady = Boolean(
    import.meta.env.VITE_SOLANA_PRIVATE_KEY &&
    import.meta.env.VITE_HELIUS_RPC_URL &&
    import.meta.env.VITE_JUPITER_REFERRAL_ACCOUNT,
);

export const useTrade = (
  tokenAddress: string,
  tokenAtomicBalance: Decimal,
  route: ResolvedRoute,
) => {
  const createTransaction = useCallback(
    async (params: CreateTransactionParams) => {
      const { direction, value, signer, connection, slippageBps, priorityFeeMicroLamports } = params;

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

        // Jupiter Ultra returns an already-serialized transaction with its own
        // priority fee baked in — our estimate would be discarded, so skip the
        // RPC round-trip entirely for that route.
        let priorityFeeMicroLamports: number | undefined;
        if (route.routeId === "raydium-clmm") {
          if (priorityFee.mode === "fixed") {
            priorityFeeMicroLamports = priorityFee.microLamports;
          } else {
            const accountKeys = route.poolAddress
              ? [new PublicKey(route.poolAddress)]
              : [];
            priorityFeeMicroLamports = await getPriorityFeeEstimate(connection, accountKeys);
          }
        }

        const transaction = await createTransaction({
          direction,
          value,
          signer: keypair.publicKey,
          connection,
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
    [createTransaction, route.routeId, route.poolAddress],
  );

  return {
    executeTrade,
    envReady,
  };
};
