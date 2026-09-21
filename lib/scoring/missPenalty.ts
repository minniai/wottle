/**
 * The miss penalty (rules §5.6, 2026-09-21). A move that scores no word is a
 * miss and costs a flat −5. At 0:00 every move a player has not made costs −5
 * too, so running out of time costs points rather than the match.
 */
export const MISS_PENALTY = -5;

/** The penalty for `unplayed` moves at 0:00. */
export function timeoutPenalty(unplayed: number): number {
  return unplayed > 0 ? MISS_PENALTY * unplayed : 0;
}

export interface MoveValuesInput {
  movesPlayed: number;
  /** Move numbers (1-based) that scored at least one word. */
  scoredMoves: Set<number>;
  moveLimit: number;
  /** The match ended on the clock: unplayed moves are penalised. */
  penalizeUnplayed: boolean;
}

/**
 * One entry per move, 1..moveLimit: `null` for a move that scored (its words
 * carry its points), the penalty for a miss or a penalised unplayed move, and
 * `undefined` for a move not played (yet).
 */
export function moveValues({ movesPlayed, scoredMoves, moveLimit, penalizeUnplayed }: MoveValuesInput): Array<number | null | undefined> {
  return Array.from({ length: moveLimit }, (_, i) => {
    const move = i + 1;
    if (move <= movesPlayed) return scoredMoves.has(move) ? null : MISS_PENALTY;
    return penalizeUnplayed ? MISS_PENALTY : undefined;
  });
}
