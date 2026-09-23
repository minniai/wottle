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
}

/** The browser tab during a match (spec 068 FR-025): `3:12 · move 4 · Wottle`; the name alone otherwise. */
export function tabTitle({ live, clockMs, move, table }: TabTitleInput, copy: Copy): string {
  if (table) {
    const beat = table.startsIn ? copy.table.titleStarting(table.startsIn, table.opponentName) : copy.table.titleTable(table.opponentName);
    return `${beat} · ${copy.WORDMARK}`;
  }
  return live ? copy.tabTitle(formatClock(clockMs), move, copy.WORDMARK) : copy.WORDMARK;
}
