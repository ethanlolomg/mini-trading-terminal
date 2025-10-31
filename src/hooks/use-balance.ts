import { useCallback, useEffect, useState } from "react";
import { getTokenBalance, createKeypair, createConnection, getSolanaBalance } from "@/lib/solana";
import Decimal from "decimal.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const useBalance = (tokenAddress: string, tokenDecimals: number) => {
  const [solanaBalance, setSolBalance] = useState<number>(0);
  const [solanaAtomicBalance, setSolanaAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenAtomicBalance, setTokenAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [loading, setLoading] = useState<boolean>(true);

  const connection = createConnection();
  const keypair = createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
  const publicKey = keypair.publicKey;

  const refreshBalance = useCallback(async () => {
    setLoading(true);
    const tokenBalance = await getTokenBalance(publicKey.toBase58(), tokenAddress, connection);
    const tokenAtomicBalance = tokenBalance.div(new Decimal(10).pow(tokenDecimals));
    setTokenBalance(Number(tokenBalance));
    setTokenAtomicBalance(tokenAtomicBalance);
    const solBalance = await getSolanaBalance(publicKey.toBase58(), connection);
    const solAtomicBalance = solBalance.div(LAMPORTS_PER_SOL);
    setSolBalance(Number(solBalance));
    setSolanaAtomicBalance(solAtomicBalance);
    setLoading(false);
  }, [tokenAddress, tokenDecimals, connection, publicKey]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return { solanaBalance, tokenBalance, solanaAtomicBalance, tokenAtomicBalance, loading, refreshBalance };
};