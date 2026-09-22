/**
 * The miss penalty (rules §5.6, 2026-09-21; floored at zero 2026-09-22). A move
 * that scores no word is a miss and costs up to 5 points, never more than the
 * player has, so a total never goes below zero. At 0:00 every move a player
 * has not made is a miss too, so running out of time costs points rather than
 * the match.
 */
export const MISS_PENALTY = -5;

/** What a miss costs a player whose total is `total` before it: −5, or less near zero. */
export function missPenaltyFor(total: number): number {
  return total > 0 ? -Math.min(-MISS_PENALTY, total) : 0;
}

/** The penalty for `unplayed` moves at 0:00, each a miss taken from `total`. */
export function timeoutPenalty(total: number, unplayed: number): number {
  const owed = Math.min(Math.max(total, 0), -MISS_PENALTY * Math.max(unplayed, 0));
  return owed > 0 ? -owed : 0;
}

export interface MoveValuesInput {
  movesPlayed: number;
  /** Points of each move (1-based) that scored at least one word. */
  movePoints: Map<number, number>;
  moveLimit: number;
  /** The match ended on the clock: unplayed moves are penalised. */
  penalizeUnplayed: boolean;
}

/**
 * One entry per move, 1..moveLimit: `null` for a move that scored (its words
 * carry its points), the penalty for a miss or a penalised unplayed move, and
 * `undefined` for a move not played (yet). Each penalty is taken from the
 * running total of the moves before it.
 */
export function moveValues({ movesPlayed, movePoints, moveLimit, penalizeUnplayed }: MoveValuesInput): Array<number | null | undefined> {
  let total = 0;
  return Array.from({ length: moveLimit }, (_, i) => {
    const move = i + 1;
    const points = movePoints.get(move);
    if (move <= movesPlayed && points !== undefined) {
      total += points;
      return null;
    }
    if (move > movesPlayed && !penalizeUnplayed) return undefined;
    const penalty = missPenaltyFor(total);
    total += penalty;
    return penalty;
  });
}
