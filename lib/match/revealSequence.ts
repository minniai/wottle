import type { RoundSummary, RoundMove } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";

export interface RevealSequence {
  orderedMoves: RoundMove[];
  highlightsFor: (playerId: string) => Coordinate[];
  deltaFor: (playerId: string) => number;
}

/**
 * Derives the sequential reveal order from a RoundSummary.
 *
 * Sorts moves by submittedAt ascending (first submitter revealed first).
 * Per-player highlights and score deltas are computed client-side from
 * the existing words array — no additional server data required.
 */
export function deriveRevealSequence(summary: RoundSummary): RevealSequence {
  const orderedMoves = [...summary.moves].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );

  const highlightsFor = (playerId: string): Coordinate[] =>
    summary.words
      .filter((w) => w.playerId === playerId)
      .flatMap((w) => w.coordinates);

  const deltaFor = (playerId: string): number =>
    summary.words
      .filter((w) => w.playerId === playerId)
      .reduce((sum, w) => sum + w.totalPoints, 0);

  return { orderedMoves, highlightsFor, deltaFor };
}
