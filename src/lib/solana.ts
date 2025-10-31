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

export const signTransaction = async (keypair: Keypair, transaction: VersionedTransaction) => {
  transaction.sign([keypair]);
  const serializedTx = transaction.serialize();
  return VersionedTransaction.deserialize(Buffer.from(serializedTx));
};

export const sendTransaction = async (transaction: VersionedTransaction, connection: Connection) => {
  const signature = await connection.sendTransaction(transaction);
  const blockHash = await connection.getLatestBlockhash();
  const response = await connection.confirmTransaction(
    {
      signature,
      blockhash: blockHash.blockhash,
      lastValidBlockHeight: blockHash.lastValidBlockHeight,
    },
    "processed",
  );
  return response;
};