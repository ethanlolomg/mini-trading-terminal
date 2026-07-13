import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstantTradeStore } from "@/stores/instantTradeStore";

/**
 * The "Instant Trade" button shown right below the chart. Toggles the floating
 * panel on/off.
 */
export function InstantTradeToggle() {
  const isOpen = useInstantTradeStore((s) => s.isOpen);
  const toggleOpen = useInstantTradeStore((s) => s.toggleOpen);

  return (
    <button
      onClick={toggleOpen}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        isOpen
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-muted/30 text-foreground hover:bg-muted/50",
      )}
    >
      <Zap className="size-4" />
      Instant Trade
    </button>
  );
}
