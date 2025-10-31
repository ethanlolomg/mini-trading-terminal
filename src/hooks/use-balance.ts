import { useCallback, useEffect, useState } from "react";
import { getTokenBalance, createKeypair, createConnection, getSolanaBalance } from "@/lib/solana";

export const useBalance = (tokenAddress: string, tokenDecimals: number) => {
  const [solanaBalance, setSolBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const connection = createConnection();
  const keypair = createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
  const publicKey = keypair.publicKey;

  const refreshBalance = useCallback(async () => {
    setLoading(true);
    const tokenBalance = await getTokenBalance(publicKey.toBase58(), tokenAddress, tokenDecimals, connection);
    setTokenBalance(Number(tokenBalance));
    const solBalance = await getSolanaBalance(publicKey.toBase58(), connection);
    setSolBalance(solBalance);
    setLoading(false);
  }, [tokenAddress, tokenDecimals, connection, publicKey]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return { solanaBalance, tokenBalance, loading, refreshBalance };
};