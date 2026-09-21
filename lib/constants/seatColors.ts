import type { PlayerSlot } from "@/lib/types/match";

/**
 * Seat-relative colour (design system §2). Teal is always the viewer, coral the
 * opponent — never bound to `player_a` / `player_b`. All values are CSS variable
 * references so the seven-token rule is enforced in one place (`app/globals.css`).
 */
export type Seat = "you" | "opp";

export interface SeatColors {
  /** Full-strength ink: letters, numerals on scored letters, lanes, totals, squares. */
  ink: string;
  /** 14% tint — settled word band. */
  band: string;
  /** 30% tint — live reveal band. */
  live: string;
  /**
   * Seat colour for text below 17px. The same as `ink` for the viewer (teal is
   * 4.9:1 on paper); a darker coral for the opponent, where `ink` is 3.9:1 and
   * fails AA for small text (spec 045 decision 2). The asymmetry lives here so no caller has
   * to know about it.
   */
  text: string;
}

export function resolveSeat(viewerSlot: PlayerSlot, slot: PlayerSlot): Seat {
  return slot === viewerSlot ? "you" : "opp";
}

/** Read-only viewers (no slot) see player A as the bottom/teal seat. */
export function seatForSlot(viewerSlot: PlayerSlot | null, slot: PlayerSlot): Seat {
  if (viewerSlot === null) return slot === "player_a" ? "you" : "opp";
  return resolveSeat(viewerSlot, slot);
}

export function getSeatColors(seat: Seat): SeatColors {
  return {
    ink: `var(--${seat})`,
    band: `var(--${seat}-band)`,
    live: `var(--${seat}-live)`,
    text: seat === "opp" ? "var(--opp-text)" : "var(--you)",
  };
}
