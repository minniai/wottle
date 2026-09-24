import type { AccumulatedWord } from "./ledgerRows";

/** The viewer's highest-scoring word, for the result's `your best word · BORÐA 29` (D1); the earlier on a tie. */
export function bestWordOf(words: AccumulatedWord[], viewerId: string): { word: string; points: number } | null {
  const mine = words.filter((w) => w.playerId === viewerId).sort((a, b) => b.totalPoints - a.totalPoints || a.globalSeq - b.globalSeq);
  return mine[0] ? { word: mine[0].word, points: mine[0].totalPoints } : null;
}
