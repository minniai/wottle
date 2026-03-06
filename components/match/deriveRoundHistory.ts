import { calculateComboBonus } from "@/lib/game-engine/scorer";
import type { ScoreboardRow, WordHistoryRow } from "@/components/match/FinalSummary";

export interface RoundPlayerSlice {
  playerId: string;
  username: string;
  delta: number;
  cumulative: number;
  words: WordHistoryRow[];
  comboBonus: number;
}

export interface RoundHistoryEntry {
  roundNumber: number;
  playerA: RoundPlayerSlice;
  playerB: RoundPlayerSlice;
}

function buildSlice(
  playerId: string,
  username: string,
  words: WordHistoryRow[],
  delta: number,
  cumulative: number,
): RoundPlayerSlice {
  const nonDuplicateCount = words.filter((w) => !w.isDuplicate).length;
  return {
    playerId,
    username,
    delta,
    cumulative,
    words,
    comboBonus: calculateComboBonus(nonDuplicateCount),
  };
}

export function deriveRoundHistory(
  words: WordHistoryRow[],
  scores: ScoreboardRow[],
  playerAId: string,
  playerAUsername: string,
  playerBId: string,
  playerBUsername: string,
): RoundHistoryEntry[] {
  const wordsByRound = new Map<number, { a: WordHistoryRow[]; b: WordHistoryRow[] }>();

  for (const w of words) {
    if (!wordsByRound.has(w.roundNumber)) {
      wordsByRound.set(w.roundNumber, { a: [], b: [] });
    }
    const bucket = wordsByRound.get(w.roundNumber)!;
    if (w.playerId === playerAId) {
      bucket.a.push(w);
    } else {
      bucket.b.push(w);
    }
  }

  return scores
    .slice()
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((row) => {
      const bucket = wordsByRound.get(row.roundNumber) ?? { a: [], b: [] };
      return {
        roundNumber: row.roundNumber,
        playerA: buildSlice(playerAId, playerAUsername, bucket.a, row.playerADelta, row.playerAScore),
        playerB: buildSlice(playerBId, playerBUsername, bucket.b, row.playerBDelta, row.playerBScore),
      };
    });
}
