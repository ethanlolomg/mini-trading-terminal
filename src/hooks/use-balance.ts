import { useCallback, useEffect, useState } from "react";
import { createKeypair } from "@/lib/solana";
import { getCodexClient } from "@/lib/codex";
import Decimal from "decimal.js";
import { Codex } from "@codex-data/sdk";

export const useBalance = (tokenAddress: string, tokenDecimals: number, nativeDecimals: number, networkId: number) => {
  const [nativeBalance, setNativeBalance] = useState<number>(0);
  const [nativeAtomicBalance, setNativeAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenAtomicBalance, setTokenAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [loading, setLoading] = useState<boolean>(true);
  const [ codexClient, setCodexClient ] = useState<Codex | null>(null);

  useEffect(() => {
    const sdk = getCodexClient();
    setCodexClient(sdk);
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const keypair = createKeypair(import.meta.env.VITE_SOLANA_PRIVATE_KEY);
      const walletAddress = keypair.publicKey.toBase58();
      setLoading(true);

      const balanceResponse = await codexClient?.queries.balances({
        input: {
          networks: [networkId],
          walletAddress: walletAddress,
          includeNative: true,
        },
      });

      // Process native balance (SOL)
      const nativeTokenId = `native:${networkId}`;
      const nativeBalance = balanceResponse?.balances?.items.find(
        item => item.tokenId === nativeTokenId
      );

      if (nativeBalance) {
        setNativeBalance(nativeBalance.shiftedBalance);
        setNativeAtomicBalance(new Decimal(nativeBalance.balance).div(10 ** nativeDecimals));
      } else {
        setNativeBalance(0);
        setNativeAtomicBalance(new Decimal(0));
      }

      // Process token balance
      const tokenTokenId = `${tokenAddress}:${networkId}`;
      const tokenBalanceItem = balanceResponse?.balances?.items.find(
        item => item.tokenId === tokenTokenId
      );

      if (tokenBalanceItem) {
        setTokenBalance(tokenBalanceItem.shiftedBalance);
        setTokenAtomicBalance(new Decimal(tokenBalanceItem.balance).div(10 ** tokenDecimals));
      } else {
        setTokenBalance(0);
        setTokenAtomicBalance(new Decimal(0));
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching balances:", error);
      setLoading(false);
    }
  }, [tokenAddress, networkId]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return { nativeBalance, nativeAtomicBalance, tokenBalance, tokenAtomicBalance, loading, refreshBalance };
};