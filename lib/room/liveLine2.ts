import type { LedgerAction } from "./ledgerTypes";

/**
 * The live row's second line shows exactly one thing (spec 068 FR-031,
 * contracts/live-line2.md). Each source keeps its own hold timer; this only
 * chooses, by a fixed order, so a held source comes back when a higher one clears.
 */
export const LINE2_ORDER = ["offline", "back", "submitError", "refused", "pickCleared", "endEarlyOffer", "missedOrStakes", "instruction"] as const;

export type Line2Kind = (typeof LINE2_ORDER)[number];

/** A piece of line 2: words, a number of points lost (crimson, spec 068 FR-021) or a secondary action. */
export type Line2Part = { text: string } | { pointsLost: { value: number; label?: string } } | { action: { label: string; action: LedgerAction } };

export interface Line2Source {
  kind: Line2Kind;
  /** The whole line as words: what is announced and what tests read. */
  text: string;
  /** How to draw it when it holds a crimson number or an action; the text alone otherwise. */
  parts?: Line2Part[];
}

export function selectLine2(sources: Partial<Record<Line2Kind, Line2Source>>): Line2Source | null {
  for (const kind of LINE2_ORDER) {
    const source = sources[kind];
    if (source) return source;
  }
  return null;
}
