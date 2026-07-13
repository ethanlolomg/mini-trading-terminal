import { createContext, useContext, type ReactNode } from "react";
import { useBalance, type UseBalanceResult } from "./use-balance";

/**
 * Shares one `useBalance` instance across the token page so the sidebar and the
 * floating instant-trade panel don't each fire their own balance query — a
 * single fetch, and a trade in either panel refreshes both.
 */
const TokenBalanceContext = createContext<UseBalanceResult | null>(null);

interface TokenBalanceProviderProps {
  tokenAddress: string;
  tokenDecimals: number;
  nativeDecimals: number;
  networkId: number;
  children: ReactNode;
}

export function TokenBalanceProvider({
  tokenAddress,
  tokenDecimals,
  nativeDecimals,
  networkId,
  children,
}: TokenBalanceProviderProps) {
  const balance = useBalance(tokenAddress, tokenDecimals, nativeDecimals, networkId);
  return <TokenBalanceContext.Provider value={balance}>{children}</TokenBalanceContext.Provider>;
}

export function useTokenBalance(): UseBalanceResult {
  const ctx = useContext(TokenBalanceContext);
  if (!ctx) {
    throw new Error("useTokenBalance must be used within a TokenBalanceProvider");
  }
  return ctx;
}
