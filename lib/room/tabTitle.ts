import type { Copy } from "@/lib/i18n/copy/types";

import { formatClock } from "./clock";

export interface TabTitleInput {
  /** A match is running and the viewer is in it. */
  live: boolean;
  clockMs: number;
  /** The viewer's move now, 1..10. */
  move: number;
  /** Spec 069: at the table, and during the count once the start is set. */
  table?: { opponentName: string; startsIn?: number };
  /** Spec 071 (FR-008): the match is over; null names a draw. */
  result?: { winnerName: string | null };
}

/**
 * The browser tab during a match (spec 068 FR-025): `3:12 · move 4 · Wottle`; once it is over
 * `Birna wins · Wottle` (spec 071); the name alone otherwise.
 */
export function tabTitle({ live, clockMs, move, table, result }: TabTitleInput, copy: Copy): string {
  if (result) return `${resultHeadline(result.winnerName, copy)} · ${copy.WORDMARK}`;
  if (table) {
    const beat = table.startsIn ? copy.table.titleStarting(table.startsIn, table.opponentName) : copy.table.titleTable(table.opponentName);
    return `${beat} · ${copy.WORDMARK}`;
  }
  return live ? copy.tabTitle(formatClock(clockMs), move, copy.WORDMARK) : copy.WORDMARK;
}

/** The result's headline in sentence case: `Birna wins`, `Draw` (D1). */
export function resultHeadline(winnerName: string | null, copy: Copy): string {
  if (winnerName !== null) return copy.winsHeadline(winnerName);
  return copy.DRAW.charAt(0).toLocaleUpperCase() + copy.DRAW.slice(1);
}
