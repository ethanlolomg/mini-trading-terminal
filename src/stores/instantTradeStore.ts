import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The three memorizable preset slots shown as P1 / P2 / P3 tabs. */
export type ProfileId = "P1" | "P2" | "P3";

/**
 * Priority-fee configuration for a profile. `auto` lets the trade layer estimate
 * a compute-unit price from the network (Helius); `fixed` pins an explicit
 * micro-lamports-per-CU value.
 */
export type PriorityFee =
  | { mode: "auto" }
  | { mode: "fixed"; microLamports: number };

/** A single memorizable preset profile (buy amounts, sell %, slippage, fee). */
export interface Profile {
  /** Buy quick-amounts, in SOL. */
  buyPresets: number[];
  /** Sell quick-amounts, as a percentage of token balance. */
  sellPresets: number[];
  /** Max slippage tolerance, in basis points (100 = 1%). */
  slippageBps: number;
  priorityFee: PriorityFee;
}

export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

interface InstantTradeState {
  /** Whether the floating panel is visible. */
  isOpen: boolean;
  /** Top-left offset of the panel, in px from the viewport origin. */
  position: PanelPosition;
  size: PanelSize;
  activeProfileId: ProfileId;
  profiles: Record<ProfileId, Profile>;

  // actions
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setPosition: (position: PanelPosition) => void;
  setSize: (size: PanelSize) => void;
  setActiveProfile: (id: ProfileId) => void;
  updateProfile: (id: ProfileId, patch: Partial<Profile>) => void;
}

const DEFAULT_PROFILE: Profile = {
  buyPresets: [0.001, 0.01, 0.1, 1],
  sellPresets: [10, 25, 50, 100],
  slippageBps: 100,
  priorityFee: { mode: "auto" },
};

/** Minimum panel dimensions; the resize hook clamps to these. */
export const PANEL_MIN_WIDTH = 320;
export const PANEL_MIN_HEIGHT = 300;

const DEFAULT_SIZE: PanelSize = { width: 380, height: 420 };

/** Default the panel to the top-right, mirroring the o1 reference placement. */
function defaultPosition(): PanelPosition {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  return { x: Math.max(24, window.innerWidth - DEFAULT_SIZE.width - 32), y: 96 };
}

export const useInstantTradeStore = create<InstantTradeState>()(
  persist(
    (set) => ({
      isOpen: false,
      position: defaultPosition(),
      size: DEFAULT_SIZE,
      activeProfileId: "P1",
      profiles: {
        P1: { ...DEFAULT_PROFILE },
        P2: { ...DEFAULT_PROFILE },
        P3: { ...DEFAULT_PROFILE },
      },

      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      setPosition: (position) => set({ position }),
      setSize: (size) => set({ size }),
      setActiveProfile: (id) => set({ activeProfileId: id }),
      updateProfile: (id, patch) =>
        set((s) => ({
          profiles: { ...s.profiles, [id]: { ...s.profiles[id], ...patch } },
        })),
    }),
    {
      name: "instant-trade",
      version: 1,
    },
  ),
);
