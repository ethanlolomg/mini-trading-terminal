import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export const createConnection = () => {
  return new Connection(import.meta.env.VITE_SOLANA_RPC_URL);
};

export const fetchSolanaBalance = async (publicKey: string, connection: Connection) => {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return balance;
};

export const getTokenBalance = async (
  publicKey: string,
  tokenAddress: string,
  connection: Connection,
): Promise<string> => {
  try {
    const mint = new PublicKey(tokenAddress);
    const owner = new PublicKey(publicKey);

    const tokenAccountInfo = await connection.getAccountInfo(mint);
    if (!tokenAccountInfo) {
      return "0";
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
      return response.value.amount;
    } catch (_error) {
      return "0";
    }
  } catch (error) {
    console.error(`Error fetching Solana token balance:`, error);
    return "0";
  }
};

export const signTransaction = async (privateKey: string, transaction: VersionedTransaction) => {
  const privateKeyBytes = new Uint8Array(
    Buffer.from(privateKey, "hex"),
  );

  const payer = Keypair.fromSeed(privateKeyBytes);
  transaction.sign([payer]);

  const serializedTx = transaction.serialize();
  return Buffer.from(serializedTx).toString("hex");
};