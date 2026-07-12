import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import Decimal from "decimal.js";
import bs58 from "bs58";

export const createConnection = () => {
  return new Connection(import.meta.env.VITE_HELIUS_RPC_URL);
};

export const createKeypair = (privateKey: string) => {
  const secretKey = bs58.decode(privateKey);
  return Keypair.fromSecretKey(secretKey);
};

export const getSolanaBalance = async (publicKey: string, connection: Connection): Promise<Decimal> => {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return new Decimal(balance);
};

export const getTokenBalance = async (
  publicKey: string,
  tokenAddress: string,
  connection: Connection,
): Promise<Decimal> => {
  try {
    const mint = new PublicKey(tokenAddress);
    const owner = new PublicKey(publicKey);

    const tokenAccountInfo = await connection.getAccountInfo(mint);
    if (!tokenAccountInfo) {
      return new Decimal(0);
    }

    const tokenAccountPubkey = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      tokenAccountInfo.owner,
    );

    try {
      const response =
        await connection.getTokenAccountBalance(tokenAccountPubkey);
      return new Decimal(response.value.amount);
    } catch (_error) {
      return new Decimal(0);
    }
  } catch (error) {
    console.error(`Error fetching Solana token balance:`, error);
    return new Decimal(0);
  }
};

export const signTransaction = (keypair: Keypair, transaction: VersionedTransaction): VersionedTransaction => {
  transaction.sign([keypair]);
  return transaction;
};

export const sendTransaction = async (transaction: VersionedTransaction, connection: Connection) => {
  const signature = await connection.sendTransaction(transaction);
  return signature;
};

/** Used when the fee estimate is unavailable. */
const AUTO_PRIORITY_FEE_FALLBACK = 50_000; // micro-lamports per CU

/**
 * Estimate a compute-unit price (micro-lamports per CU) for `priorityFee: auto`.
 * Uses Helius's dedicated `getPriorityFeeEstimate` RPC (the standard
 * `getRecentPrioritizationFees` reports mostly-zero for a single account, which
 * is useless as a signal). `accountKeys` scopes the estimate to the accounts the
 * swap writes to (e.g. the pool). Falls back to a constant on any error.
 */
export const getPriorityFeeEstimate = async (
  connection: Connection,
  accountKeys: PublicKey[] = [],
): Promise<number> => {
  try {
    const response = await fetch(connection.rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "priority-fee-estimate",
        method: "getPriorityFeeEstimate",
        params: [
          {
            accountKeys: accountKeys.map((k) => k.toBase58()),
            options: { recommended: true },
          },
        ],
      }),
    });
    const json = await response.json();
    const estimate = json?.result?.priorityFeeEstimate;
    return typeof estimate === "number" && estimate > 0
      ? Math.ceil(estimate)
      : AUTO_PRIORITY_FEE_FALLBACK;
  } catch (error) {
    console.error("Error estimating priority fee:", error);
    return AUTO_PRIORITY_FEE_FALLBACK;
  }
};

export const confirmTransaction = async (signature: string, connection: Connection) => {
  const blockHash = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: blockHash.blockhash,
    lastValidBlockHeight: blockHash.lastValidBlockHeight,
  }, "confirmed");
  return confirmation;
};