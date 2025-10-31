import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";

export const createConnection = () => {
  return new Connection(import.meta.env.VITE_SOLANA_RPC_URL);
};

export const fetchSolanaBalance = async (publicKey: string, connection: Connection) => {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return balance;
};

export const fetchTokenBalance = async (publicKey: string, tokenMint: string, connection: Connection) => {
  const balance = await connection.getTokenAccountBalance(new PublicKey(publicKey), new PublicKey(tokenMint));
  return balance;
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