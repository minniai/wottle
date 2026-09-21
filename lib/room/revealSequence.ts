/**
 * The reveal (design system §6, §7): bands draw along each word 400 ms apart
 * (120 ms stagger), the ledger writes each word as its band lands, totals count
 * up, then everything settles. Under reduced motion there is only the end state.
 * Words already drawn are never drawn twice (spec 044, Clarifications Q3).
 */
export const BAND_DRAW_MS = 400;
export const BAND_STAGGER_MS = 120;
export const COUNT_UP_MS = 400;
export const SETTLE_MS = 200;
/** Your scored row holds before the next move opens (spec 050 FR-013): a reading pause, not motion. */
export const MOVE_HOLD_MS = 600;
/** The match-over slip lands this long after the final settle (spec 048 FR-003). */
export const MATCH_OVER_DELAY_MS = 600;

export type RevealStepKind = "band" | "write" | "countUp" | "settle";

export interface RevealStep {
  at: number;
  kind: RevealStepKind;
  /** Index into the *new* words of this reveal, for band/write steps. */
  wordIndex?: number;
}

export interface RevealPlanOptions {
  reducedMotion: boolean;
  alreadyDrawn: Set<string>;
}

export interface RevealProgress {
  bandsDrawn: number;
  wordsWritten: number;
  totalsShown: boolean;
  settled: boolean;
}

export const REVEAL_DONE: RevealProgress = { bandsDrawn: Infinity, wordsWritten: Infinity, totalsShown: true, settled: true };
export const REVEAL_START: RevealProgress = { bandsDrawn: 0, wordsWritten: 0, totalsShown: false, settled: false };

/** Filter to the words this reveal must animate, in order. */
export function newWordIds(ids: string[], alreadyDrawn: Set<string>): string[] {
  return ids.filter((id) => !alreadyDrawn.has(id));
}

export function planReveal(ids: string[], opts: RevealPlanOptions): RevealStep[] {
  const fresh = newWordIds(ids, opts.alreadyDrawn);
  if (opts.reducedMotion || fresh.length === 0) return [{ at: 0, kind: "settle" }];
  const steps: RevealStep[] = [];
  fresh.forEach((_, i) => {
    const start = i * (BAND_DRAW_MS + BAND_STAGGER_MS);
    steps.push({ at: start, kind: "band", wordIndex: i });
    steps.push({ at: start + BAND_DRAW_MS, kind: "write", wordIndex: i });
  });
  const lastBandEnd = (fresh.length - 1) * (BAND_DRAW_MS + BAND_STAGGER_MS) + BAND_DRAW_MS;
  steps.push({ at: lastBandEnd, kind: "countUp" });
  steps.push({ at: lastBandEnd + COUNT_UP_MS + SETTLE_MS, kind: "settle" });
  return steps;
}

export function applyStep(progress: RevealProgress, step: RevealStep): RevealProgress {
  switch (step.kind) {
    case "band":
      return { ...progress, bandsDrawn: Math.max(progress.bandsDrawn, (step.wordIndex ?? 0) + 1) };
    case "write":
      return { ...progress, wordsWritten: Math.max(progress.wordsWritten, (step.wordIndex ?? 0) + 1) };
    case "countUp":
      return { ...progress, totalsShown: true };
    case "settle":
      return REVEAL_DONE;
  }
}

/** Total duration of a plan (the settle step). */
export function planDuration(steps: RevealStep[]): number {
  return steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.at));
}
