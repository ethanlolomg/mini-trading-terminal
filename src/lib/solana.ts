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

/** Used when the network returns no recent fee samples. */
const AUTO_PRIORITY_FEE_FALLBACK = 50_000; // micro-lamports per CU

/**
 * Estimate a compute-unit price (micro-lamports per CU) for `priorityFee: auto`.
 * Uses the standard `getRecentPrioritizationFees` RPC (available on Helius) and
 * takes the 75th percentile of recent non-zero fees for reasonably fast
 * inclusion, falling back to a constant if no samples are available.
 */
export const getPriorityFeeEstimate = async (
  connection: Connection,
  lockedWritableAccounts: PublicKey[] = [],
): Promise<number> => {
  try {
    const fees = await connection.getRecentPrioritizationFees(
      lockedWritableAccounts.length ? { lockedWritableAccounts } : undefined,
    );
    const values = fees
      .map((f) => f.prioritizationFee)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (values.length === 0) return AUTO_PRIORITY_FEE_FALLBACK;
    const idx = Math.min(Math.floor(values.length * 0.75), values.length - 1);
    return Math.max(values[idx], 1);
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