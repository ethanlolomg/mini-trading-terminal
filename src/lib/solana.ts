import { Connection, PublicKey, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export const createConnection = () => {
  return new Connection(import.meta.env.VITE_SOLANA_RPC_URL);
};

export const createKeypair = (privateKey: string) => {
  const privateKeyBytes = Uint8Array.from(
    Buffer.from(privateKey, 'hex')
  );
  return Keypair.fromSecretKey(privateKeyBytes);
};

export const getSolanaBalance = async (publicKey: string, connection: Connection) => {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return balance / LAMPORTS_PER_SOL;
};

export const getTokenBalance = async (
  publicKey: string,
  tokenAddress: string,
  tokenDecimals: number,
  connection: Connection,
): Promise<number> => {
  try {
    const mint = new PublicKey(tokenAddress);
    const owner = new PublicKey(publicKey);

    const tokenAccountInfo = await connection.getAccountInfo(mint);
    if (!tokenAccountInfo) {
      return 0;
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
      return Number(response.value.amount) / 10 ** tokenDecimals;
    } catch (_error) {
      return 0;
    }
  } catch (error) {
    console.error(`Error fetching Solana token balance:`, error);
    return 0;
  }
};

export const signTransaction = async (keypair: Keypair, transaction: VersionedTransaction) => {
  transaction.sign([keypair]);
  const serializedTx = transaction.serialize();
  return Buffer.from(serializedTx).toString("hex");
};