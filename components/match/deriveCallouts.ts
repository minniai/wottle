import type { ScoreboardRow, WordHistoryRow } from "@/components/match/FinalSummary";

export interface BiggestSwingCallout {
  roundNumber: number;
  swingAmount: number;
  favoredPlayerId: string;
}

export interface HighestScoringWordCallout {
  word: string;
  totalPoints: number;
  playerId: string;
  username: string;
  roundNumber: number;
}

export function deriveBiggestSwing(scores: ScoreboardRow[]): BiggestSwingCallout | null {
  let best: BiggestSwingCallout | null = null;

  for (const row of scores) {
    const swing = Math.abs(row.playerADelta - row.playerBDelta);
    if (swing === 0) continue;

    if (best === null || swing > best.swingAmount) {
      best = {
        roundNumber: row.roundNumber,
        swingAmount: swing,
        favoredPlayerId: row.playerADelta >= row.playerBDelta ? "player-a" : "player-b",
      };
    }
    // Equal swing: earlier round already in `best` (iteration is ordered)
  }

  return best;
}

export function deriveHighestScoringWord(
  words: WordHistoryRow[],
  usernameMap: Record<string, string>,
): HighestScoringWordCallout | null {
  const candidates = words.filter((w) => !w.isDuplicate && w.totalPoints > 0);
  if (candidates.length === 0) return null;

  const best = candidates.reduce((winner, candidate) => {
    if (candidate.totalPoints > winner.totalPoints) return candidate;
    if (candidate.totalPoints < winner.totalPoints) return winner;
    // Tiebreaker 1: earlier round
    if (candidate.roundNumber < winner.roundNumber) return candidate;
    if (candidate.roundNumber > winner.roundNumber) return winner;
    // Tiebreaker 2: alphabetical username
    const candidateName = usernameMap[candidate.playerId] ?? candidate.playerId;
    const winnerName = usernameMap[winner.playerId] ?? winner.playerId;
    return candidateName < winnerName ? candidate : winner;
  });

  return {
    word: best.word,
    totalPoints: best.totalPoints,
    playerId: best.playerId,
    username: usernameMap[best.playerId] ?? best.playerId,
    roundNumber: best.roundNumber,
  };
}
