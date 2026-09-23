import type { Stakes } from "@/lib/types/match";

import { calculateElo, determineKFactor } from "./calculateElo";
import type { RatingRecord } from "./playerRatings";

const OUTCOMES = { win: 1, draw: 0.5, loss: 0 } as const;

/**
 * What a match is worth to one player before it starts (spec 069 FR-008): the
 * rating change the settlement's own rule would write for a win, a draw and a loss.
 */
export function stakesFor(me: RatingRecord, opponent: RatingRecord): Stakes {
  const change = (actualScore: number): number =>
    calculateElo({ playerRating: me.eloRating, opponentRating: opponent.eloRating, actualScore, kFactor: determineKFactor(me.gamesPlayed) }).delta;
  return { win: change(OUTCOMES.win), draw: change(OUTCOMES.draw), loss: change(OUTCOMES.loss) };
}
