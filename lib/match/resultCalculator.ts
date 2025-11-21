import type { ScoreTotals } from "@/lib/types/match";

type MatchStateSummary = {
  state: string;
  playerAId: string;
  playerBId: string;
};

export interface MatchWinnerResult {
  winnerId: string | null;
  loserId: string | null;
  isDraw: boolean;
}

export function determineMatchWinner(
  scores: ScoreTotals,
  playerAId: string,
  playerBId: string,
): MatchWinnerResult {
  if (scores.playerA > scores.playerB) {
    return { winnerId: playerAId, loserId: playerBId, isDraw: false };
  }
  if (scores.playerB > scores.playerA) {
    return { winnerId: playerBId, loserId: playerAId, isDraw: false };
  }
  return { winnerId: null, loserId: null, isDraw: true };
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

