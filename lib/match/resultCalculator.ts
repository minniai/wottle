import type { ScoreTotals } from "@/lib/types/match";

type MatchStateSummary = {
  state: string;
  playerAId: string;
  playerBId: string;
};

/** Why a naturally ended match ended (spec 050 FR-010). */
export type NaturalEndReason = "moves_complete" | "incomplete" | "both_incomplete";

export interface MatchWinnerResult {
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
  reason: NaturalEndReason;
}

export interface MatchWinnerInput {
  scores: ScoreTotals;
  /** Resolved moves per player. */
  moves: { playerA: number; playerB: number };
  moveLimit: number;
  /** Exclusively owned frozen tiles per player. */
  frozenCounts: { playerA: number; playerB: number };
}

type Seat = "playerA" | "playerB";

function winner(seat: Seat, ids: { playerA: string; playerB: string }, reason: NaturalEndReason): MatchWinnerResult {
  const other: Seat = seat === "playerA" ? "playerB" : "playerA";
  return { winnerId: ids[seat], loserId: ids[other], isDraw: false, reason };
}

function draw(reason: NaturalEndReason): MatchWinnerResult {
  return { winnerId: null, loserId: null, isDraw: true, reason };
}

function higher(pair: { playerA: number; playerB: number }): Seat | null {
  if (pair.playerA > pair.playerB) return "playerA";
  if (pair.playerB > pair.playerA) return "playerB";
  return null;
}

/**
 * The end rules, in order (rules §2a, spec 050): a player short of the move
 * limit loses whatever the totals; both short is a draw; otherwise the higher
 * total, then more exclusively owned frozen tiles, then a draw.
 */
export function determineMatchWinner(
  input: MatchWinnerInput,
  playerAId: string,
  playerBId: string,
): MatchWinnerResult {
  const ids = { playerA: playerAId, playerB: playerBId };
  const aDone = input.moves.playerA >= input.moveLimit;
  const bDone = input.moves.playerB >= input.moveLimit;
  if (!aDone && !bDone) return draw("both_incomplete");
  if (!aDone) return winner("playerB", ids, "incomplete");
  if (!bDone) return winner("playerA", ids, "incomplete");
  const byScore = higher(input.scores);
  if (byScore) return winner(byScore, ids, "moves_complete");
  const byTiles = higher(input.frozenCounts);
  if (byTiles) return winner(byTiles, ids, "moves_complete");
  return draw("moves_complete");
}

export function assertRematchAllowed(match: MatchStateSummary, playerId: string) {
  if (match.state !== "completed") {
    throw new Error("Match is not finished yet. Rematch unavailable.");
  }

  const isParticipant = playerId === match.playerAId || playerId === match.playerBId;
  if (!isParticipant) {
    throw new Error("Only participants in the finished match can request a rematch.");
  }
}
