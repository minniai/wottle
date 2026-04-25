import type { PlayerSlot } from "@/lib/types/match";

// Player slot colors — single source of truth, resolves to the OKLCH design
// tokens defined in app/globals.css (--p1 = warm ochre / "player A",
// --p2 = design blue / "player B"). String values are usable in inline styles
// (`style={{ color }}`, `backgroundColor: playerColor`) where the browser
// resolves the var at paint time. Keeping the var indirection means a future
// theme flip retunes every player surface in one place.

export const PLAYER_A_HEX = "var(--p1)";
export const PLAYER_B_HEX = "var(--p2)";

// Frozen-tile overlays (40% alpha)
export const PLAYER_A_OVERLAY = "oklch(0.68 0.14 60 / 0.4)";
export const PLAYER_B_OVERLAY = "oklch(0.56 0.08 220 / 0.4)";

// Scored-tile highlights (60% alpha) — used by the in-match round-recap
// animation where tiles flash briefly on a paper-coloured board.
export const PLAYER_A_HIGHLIGHT = "oklch(0.68 0.14 60 / 0.6)";
export const PLAYER_B_HIGHLIGHT = "oklch(0.56 0.08 220 / 0.6)";

// Post-game hover highlights (issue #208 follow-up): brighter than the
// scored/frozen layers so hovering a round/word in history *lifts* the
// tile rather than darkening it. Higher OKLCH lightness keeps these
// readable against both the cream paper and the player frozen overlays.
export const PLAYER_A_HOVER_HIGHLIGHT = "oklch(0.88 0.10 70 / 0.9)";
export const PLAYER_B_HOVER_HIGHLIGHT = "oklch(0.82 0.07 220 / 0.9)";

// Selected-tile colors (issue #209): player-identity hue rendered as a *light*
// tint on the tile body with a *deep* solid border, so the click-to-pick
// state lifts the tile rather than darkening it. The light fill matches the
// `--p1-tint` / `--p2-tint` design tokens (lightness ≈ 0.92), and the deep
// border matches `--p1-deep` / `--p2-deep`. This keeps selected visually
// lighter than scored highlights (60% α saturated hue) and frozen overlays
// (40% α saturated hue), giving each state its own clear weight.
export const PLAYER_A_SELECTED_BG = "oklch(0.92 0.06 70 / 0.85)";
export const PLAYER_A_SELECTED_BORDER = "oklch(0.48 0.14 55)";
export const PLAYER_B_SELECTED_BG = "oklch(0.86 0.04 220 / 0.85)";
export const PLAYER_B_SELECTED_BORDER = "oklch(0.38 0.08 220)";

// Locked-tile colors (post-submission swap highlight): keep the player's
// identity hue at the same 70% saturation the original ochre used, so the
// "I just swapped these" cue stays strong but follows the active player's
// color. Without this, Player B's tiles flipped from blue (selected) back
// to orange (legacy --ochre fallback) on submit.
export const PLAYER_A_LOCKED_BG = "oklch(0.68 0.14 60 / 0.7)";
export const PLAYER_B_LOCKED_BG = "oklch(0.56 0.08 220 / 0.7)";

// Both-player gradient (split diagonal) for shared / contested tiles
export const BOTH_GRADIENT =
  "linear-gradient(135deg, oklch(0.68 0.14 60 / 0.4) 50%, oklch(0.56 0.08 220 / 0.4) 50%)";

export interface PlayerColorSet {
  hex: string;
  overlay: string;
  highlight: string;
  selectedBg: string;
  selectedBorder: string;
  lockedBg: string;
}

const PLAYER_A_COLORS: PlayerColorSet = {
  hex: PLAYER_A_HEX,
  overlay: PLAYER_A_OVERLAY,
  highlight: PLAYER_A_HIGHLIGHT,
  selectedBg: PLAYER_A_SELECTED_BG,
  selectedBorder: PLAYER_A_SELECTED_BORDER,
  lockedBg: PLAYER_A_LOCKED_BG,
};

const PLAYER_B_COLORS: PlayerColorSet = {
  hex: PLAYER_B_HEX,
  overlay: PLAYER_B_OVERLAY,
  highlight: PLAYER_B_HIGHLIGHT,
  selectedBg: PLAYER_B_SELECTED_BG,
  selectedBorder: PLAYER_B_SELECTED_BORDER,
  lockedBg: PLAYER_B_LOCKED_BG,
};

/** Return the color set for a given player slot. */
export function getPlayerColors(slot: PlayerSlot): PlayerColorSet {
  return slot === "player_a" ? PLAYER_A_COLORS : PLAYER_B_COLORS;
}
