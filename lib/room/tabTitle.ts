import type { Copy } from "@/lib/i18n/copy/types";

import { formatClock } from "./clock";

export interface TabTitleInput {
  /** A match is running and the viewer is in it. */
  live: boolean;
  clockMs: number;
  /** The viewer's move now, 1..10. */
  move: number;
}

/** The browser tab during a match (spec 068 FR-025): `3:12 · move 4 · Wottle`; the name alone otherwise. */
export function tabTitle({ live, clockMs, move }: TabTitleInput, copy: Copy): string {
  return live ? copy.tabTitle(formatClock(clockMs), move, copy.WORDMARK) : copy.WORDMARK;
}
