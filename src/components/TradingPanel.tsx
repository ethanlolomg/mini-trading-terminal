import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TradingPanelProps {
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
}

export function TradingPanel({ tokenSymbol, tokenName, tokenAddress }: TradingPanelProps) {
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellPercentage, setSellPercentage] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const privateKey = import.meta.env.VITE_SOLANA_PRIVATE_KEY;

  useEffect(() => {
    if (privateKey) {
      fetchBalance();
    } else {
      setLoading(false);
    }
  }, [privateKey]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      // TODO: Implement actual Solana balance fetching using privateKey
      setBalance(10.5);
      setTokenBalance(1000);
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrade = () => {
    if (tradeMode === "buy") {
      console.log(`Buying ${buyAmount} SOL worth of ${tokenSymbol}`);
    } else {
      console.log(`Selling ${sellPercentage}% of ${tokenSymbol} holdings`);
    }
  };

  const percentagePresets = [25, 50, 75, 100];

  if (!privateKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade {tokenSymbol || "Token"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Trading requires VITE_SOLANA_PRIVATE_KEY to be configured in environment variables.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade {tokenSymbol || "Token"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading wallet balance...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade {tokenSymbol || "Token"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
            <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-sm text-muted-foreground">SOL Balance:</span>
              <span className="font-semibold">{balance.toFixed(4)} SOL</span>
            </div>

            {tokenSymbol && (
              <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">{tokenSymbol} Balance:</span>
                <span className="font-semibold">{tokenBalance.toLocaleString()} {tokenSymbol}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setTradeMode("buy")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
                  tradeMode === "buy"
                    ? "bg-green-500/20 text-green-500 border border-green-500/50"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeMode("sell")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
                  tradeMode === "sell"
                    ? "bg-red-500/20 text-red-500 border border-red-500/50"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
              >
                Sell
              </button>
            </div>

            {tradeMode === "buy" ? (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Amount in SOL</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <div className="text-xs text-muted-foreground">
                  Available: {balance.toFixed(4)} SOL
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-sm text-muted-foreground">Sell Percentage</label>
                <div className="flex gap-2">
                  {percentagePresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setSellPercentage(preset.toString())}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all",
                        sellPercentage === preset.toString()
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="0"
                  value={sellPercentage}
                  onChange={(e) => setSellPercentage(e.target.value)}
                  min="0"
                  max="100"
                  step="1"
                />
                {sellPercentage && tokenBalance > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Selling: {((tokenBalance * parseFloat(sellPercentage)) / 100).toLocaleString()} {tokenSymbol}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={
                (tradeMode === "buy" && (!buyAmount || parseFloat(buyAmount) <= 0)) ||
                (tradeMode === "sell" && (!sellPercentage || parseFloat(sellPercentage) <= 0))
              }
              className={cn(
                "w-full py-3 px-4 rounded-lg font-semibold transition-all",
                tradeMode === "buy"
                  ? "bg-green-500 hover:bg-green-600 text-white disabled:bg-green-500/30 disabled:text-green-500/50"
                  : "bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/30 disabled:text-red-500/50",
                "disabled:cursor-not-allowed"
              )}
            >
              {tradeMode === "buy" ? "Buy" : "Sell"} {tokenSymbol || "Token"}
            </button>
      </CardContent>
    </Card>
  );
}