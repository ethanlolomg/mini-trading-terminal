import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useInstantTradeStore,
  type ProfileId,
} from "@/stores/instantTradeStore";

interface ProfileSettingsProps {
  profileId: ProfileId;
  onClose: () => void;
}

/** Replace one entry of a preset array, returning a new array. */
function replaceAt(list: number[], index: number, value: number): number[] {
  const next = list.slice();
  next[index] = value;
  return next;
}

/**
 * In-panel editor for the active profile's presets, slippage and priority fee.
 * Rendered as an overlay inside the floating panel so it drags/resizes with it.
 * Writes flow straight to the persisted store, so edits are "memorized" across
 * reloads.
 */
export function ProfileSettings({ profileId, onClose }: ProfileSettingsProps) {
  const profile = useInstantTradeStore((s) => s.profiles[profileId]);
  const updateProfile = useInstantTradeStore((s) => s.updateProfile);

  const priorityMode = profile.priorityFee.mode;

  return (
    <div
      data-no-drag
      className="absolute inset-0 z-10 flex flex-col overflow-auto bg-background p-3"
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onClose}
          title="Back"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold">Edit {profileId} presets</span>
      </div>

      <div className="space-y-4">
        <section className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Buy amounts (SOL)</label>
          <div className="grid grid-cols-4 gap-2">
            {profile.buyPresets.map((value, i) => (
              <Input
                key={i}
                type="number"
                min="0"
                step="0.001"
                value={value}
                onChange={(e) =>
                  updateProfile(profileId, {
                    buyPresets: replaceAt(profile.buyPresets, i, parseFloat(e.target.value) || 0),
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sell amounts (% of balance)</label>
          <div className="grid grid-cols-4 gap-2">
            {profile.sellPresets.map((value, i) => (
              <Input
                key={i}
                type="number"
                min="0"
                max="100"
                step="1"
                value={value}
                onChange={(e) =>
                  updateProfile(profileId, {
                    sellPresets: replaceAt(profile.sellPresets, i, parseFloat(e.target.value) || 0),
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Slippage (%)</label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={profile.slippageBps / 100}
            onChange={(e) =>
              updateProfile(profileId, {
                slippageBps: Math.round((parseFloat(e.target.value) || 0) * 100),
              })
            }
          />
        </section>

        <section className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Priority fee</label>
          <div className="flex gap-2">
            {(["auto", "fixed"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() =>
                  updateProfile(profileId, {
                    priorityFee:
                      mode === "auto"
                        ? { mode: "auto" }
                        : {
                            mode: "fixed",
                            microLamports:
                              profile.priorityFee.mode === "fixed"
                                ? profile.priorityFee.microLamports
                                : 50000,
                          },
                  })
                }
                className={cn(
                  "flex-1 rounded-md py-2 text-sm font-medium capitalize transition-all",
                  priorityMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          {profile.priorityFee.mode === "fixed" && (
            <div className="space-y-1 pt-1">
              <label className="text-xs text-muted-foreground">
                Compute-unit price (micro-lamports)
              </label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={profile.priorityFee.microLamports}
                onChange={(e) =>
                  updateProfile(profileId, {
                    priorityFee: { mode: "fixed", microLamports: parseInt(e.target.value, 10) || 0 },
                  })
                }
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
