import type { PlayerSlot } from "@/lib/types/match";

// --- Hex base colors ---
export const PLAYER_A_HEX = "#38BDF8"; // sky-400 (brighter blue for dark backgrounds)
export const PLAYER_B_HEX = "#EF4444"; // red-500

// --- Frozen tile overlays (40% opacity) ---
export const PLAYER_A_OVERLAY = "rgba(56, 189, 248, 0.4)";
export const PLAYER_B_OVERLAY = "rgba(239, 68, 68, 0.4)";

// --- Scored tile highlights (60% opacity) ---
export const PLAYER_A_HIGHLIGHT = "rgba(56, 189, 248, 0.6)";
export const PLAYER_B_HIGHLIGHT = "rgba(239, 68, 68, 0.6)";

// --- Both-player gradient (split diagonal) ---
export const BOTH_GRADIENT =
  "linear-gradient(135deg, rgba(56, 189, 248, 0.4) 50%, rgba(239, 68, 68, 0.4) 50%)";

export interface PlayerColorSet {
  hex: string;
  overlay: string;
  highlight: string;
}

const PLAYER_A_COLORS: PlayerColorSet = {
  hex: PLAYER_A_HEX,
  overlay: PLAYER_A_OVERLAY,
  highlight: PLAYER_A_HIGHLIGHT,
};

const PLAYER_B_COLORS: PlayerColorSet = {
  hex: PLAYER_B_HEX,
  overlay: PLAYER_B_OVERLAY,
  highlight: PLAYER_B_HIGHLIGHT,
};

/** Return the color set for a given player slot. */
export function getPlayerColors(slot: PlayerSlot): PlayerColorSet {
  return slot === "player_a" ? PLAYER_A_COLORS : PLAYER_B_COLORS;
}
