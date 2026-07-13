import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Wallet, Zap, Settings2 } from "lucide-react";
import { EnhancedToken, PairFilterResult } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { cn } from "@/lib/utils";
import { useBalance } from "@/hooks/use-balance";
import { useTrade } from "@/hooks/use-trade";
import { useDraggable } from "@/hooks/useDraggable";
import { useResizable } from "@/hooks/useResizable";
import { useResolvedRoute } from "@/hooks/useResolvedRoute";
import { useInstantTradeStore, type ProfileId } from "@/stores/instantTradeStore";
import { ProfileSettings } from "./ProfileSettings";

interface InstantTradePanelProps {
  token: EnhancedToken;
  pairs?: PairFilterResult[];
}

const PROFILE_IDS: ProfileId[] = ["P1", "P2", "P3"];

/**
 * Floating, draggable, resizable one-click trade panel. Geometry, active
 * profile and presets all come from the persisted store; drag/resize mutate the
 * DOM directly (see the hooks) so gestures don't re-render this tree.
 */
export function InstantTradePanel({ token, pairs = [] }: InstantTradePanelProps) {
  const isOpen = useInstantTradeStore((s) => s.isOpen);
  const position = useInstantTradeStore((s) => s.position);
  const size = useInstantTradeStore((s) => s.size);
  const activeProfileId = useInstantTradeStore((s) => s.activeProfileId);
  const profile = useInstantTradeStore((s) => s.profiles[s.activeProfileId]);
  const setPosition = useInstantTradeStore((s) => s.setPosition);
  const setSize = useInstantTradeStore((s) => s.setSize);
  const setOpen = useInstantTradeStore((s) => s.setOpen);
  const setActiveProfile = useInstantTradeStore((s) => s.setActiveProfile);

  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  useDraggable({ elementRef: panelRef, handleRef: headerRef, position, onCommit: setPosition, enabled: isOpen });
  useResizable({ elementRef: panelRef, handleRef: resizeRef, size, onCommit: setSize, enabled: isOpen });

  const route = useResolvedRoute(token.address, pairs);

  const { nativeBalance, tokenBalance, tokenAtomicBalance, refreshBalance } = useBalance(
    token.address,
    Number(token.decimals),
    9,
    Number(token.networkId),
  );
  const { executeTrade, envReady } = useTrade(token.address, tokenAtomicBalance, route);

  const [isTrading, setIsTrading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const runTrade = useCallback(
    async (direction: "buy" | "sell", value: number) => {
      if (isTrading || !envReady) return;
      setIsTrading(true);
      try {
        await executeTrade({
          direction,
          value,
          slippageBps: profile.slippageBps,
          priorityFee: profile.priorityFee,
          onSuccess: () => setTimeout(refreshBalance, 1000),
        });
      } finally {
        setIsTrading(false);
      }
    },
    [isTrading, envReady, executeTrade, profile.slippageBps, profile.priorityFee, refreshBalance],
  );

  if (!isOpen) return null;

  const tokenSymbol = token.symbol || "Token";
  const slippageLabel = `${profile.slippageBps / 100}%`;
  const priorityLabel =
    profile.priorityFee.mode === "auto" ? "AUTO" : `${profile.priorityFee.microLamports.toLocaleString()} µ`;

  return createPortal(
    <div
      ref={panelRef}
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
      className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur select-none"
      role="dialog"
      aria-label={`Instant trade ${tokenSymbol}`}
    >
      {/* Header — drag handle */}
      <div
        ref={headerRef}
        className="flex cursor-move items-center gap-1 border-b border-border bg-muted/20 px-3 py-2"
      >
        <div className="flex gap-1" data-no-drag>
          {PROFILE_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setActiveProfile(id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                id === activeProfileId
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          data-no-drag
          onClick={() => setShowSettings((v) => !v)}
          title="Edit presets"
          className={cn(
            "rounded-md p-1.5 transition-colors hover:bg-muted/50 hover:text-foreground",
            showSettings ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Settings2 className="size-4" />
        </button>
        <button
          data-no-drag
          onClick={() => setOpen(false)}
          title="Close"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
      <div className="h-full space-y-3 overflow-auto p-3">
        {!envReady ? (
          <p className="text-sm text-muted-foreground">
            Trading requires VITE_SOLANA_PRIVATE_KEY, VITE_HELIUS_RPC_URL and
            VITE_JUPITER_REFERRAL_ACCOUNT to be configured.
          </p>
        ) : (
          <>
            {/* Balances */}
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="size-3.5" /> {nativeBalance.toFixed(3)} SOL
              </span>
              <span className="font-medium">
                {tokenBalance.toLocaleString()} {tokenSymbol}
              </span>
            </div>

            {/* Buy — spend SOL to receive the token */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-green-500">Buy {tokenSymbol}</div>
              <div className="grid grid-cols-4 gap-2">
                {profile.buyPresets.map((amount, i) => (
                  <button
                    key={`${amount}-${i}`}
                    disabled={isTrading || amount <= 0 || amount > nativeBalance}
                    onClick={() => runTrade("buy", amount)}
                    className="rounded-lg border border-green-500/30 bg-green-500/10 py-2 text-xs font-medium text-green-500 transition-all hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {amount} <span className="opacity-70">SOL</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>Slippage {slippageLabel}</span>
                <span className="flex items-center gap-1">
                  <Zap className="size-3" /> {priorityLabel}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Sell — sell a % of the token balance to receive SOL */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-rose-400/80">Sell {tokenSymbol}</div>
              <div className="grid grid-cols-4 gap-2">
                {profile.sellPresets.map((pct, i) => (
                  <button
                    key={`${pct}-${i}`}
                    disabled={isTrading || pct <= 0 || tokenBalance <= 0}
                    onClick={() => runTrade("sell", pct)}
                    className="rounded-lg border border-rose-500/20 bg-rose-500/5 py-2 text-sm font-medium text-rose-400/80 transition-all hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {showSettings && (
        <ProfileSettings
          profileId={activeProfileId}
          onClose={() => setShowSettings(false)}
        />
      )}
      </div>

      {/* Resize grip */}
      <div
        ref={resizeRef}
        className="absolute bottom-0 right-0 size-4 cursor-nwse-resize"
        title="Resize"
      >
        <div className="absolute bottom-1 right-1 size-2 border-b-2 border-r-2 border-muted-foreground/50" />
      </div>
    </div>,
    document.body,
  );
}
