import { create } from "zustand";

/**
 * Holds the current player's match color (their slot's design token, e.g.
 * `var(--p2)`) while a match context is active. The global TopBar avatar lives
 * in the root layout — above any match route — so it can't read match state
 * directly. Match views (`MatchClient`, `FinalSummary`) publish the viewer's
 * slot color here on mount and clear it on unmount, letting the TopBar avatar
 * stay consistent with how the player is colored everywhere else on the page
 * (O-72). Outside a match this is null and the avatar falls back to its
 * identity gradient.
 */
interface SelfColorState {
  selfColor: string | null;
  setSelfColor: (color: string | null) => void;
  clearSelfColor: () => void;
}

export const useSelfColorStore = create<SelfColorState>((set) => ({
  selfColor: null,
  setSelfColor: (color) => set({ selfColor: color }),
  clearSelfColor: () => set({ selfColor: null }),
}));
