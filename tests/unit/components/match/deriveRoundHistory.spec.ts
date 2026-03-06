import { describe, expect, it } from "vitest";
import { deriveRoundHistory } from "@/components/match/deriveRoundHistory";
import type { WordHistoryRow, ScoreboardRow } from "@/components/match/FinalSummary";

function makeWord(overrides: Partial<WordHistoryRow> = {}): WordHistoryRow {
  return {
    roundNumber: 1,
    playerId: "player-a",
    word: "búr",
    totalPoints: 20,
    lettersPoints: 15,
    bonusPoints: 5,
    coordinates: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    ...overrides,
  };
}

function makeScore(overrides: Partial<ScoreboardRow> = {}): ScoreboardRow {
  return {
    roundNumber: 1,
    playerAScore: 20,
    playerBScore: 0,
    playerADelta: 20,
    playerBDelta: 0,
    ...overrides,
  };
}

describe("deriveRoundHistory", () => {
  it("T004: 2-round happy path — produces one entry per round with correct player data", () => {
    const words: WordHistoryRow[] = [
      makeWord({ roundNumber: 1, playerId: "player-a", word: "búr", totalPoints: 20, lettersPoints: 15, bonusPoints: 5 }),
      makeWord({ roundNumber: 1, playerId: "player-b", word: "lag", totalPoints: 15, lettersPoints: 10, bonusPoints: 5 }),
      makeWord({ roundNumber: 2, playerId: "player-a", word: "fár", totalPoints: 18, lettersPoints: 12, bonusPoints: 6 }),
    ];
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1, playerAScore: 20, playerBScore: 15, playerADelta: 20, playerBDelta: 15 }),
      makeScore({ roundNumber: 2, playerAScore: 38, playerBScore: 15, playerADelta: 18, playerBDelta: 0 }),
    ];

    const result = deriveRoundHistory(words, scores, "player-a", "Player A", "player-b", "Player B");

    expect(result).toHaveLength(2);

    const round1 = result[0];
    expect(round1.roundNumber).toBe(1);
    expect(round1.playerA.delta).toBe(20);
    expect(round1.playerA.cumulative).toBe(20);
    expect(round1.playerA.words).toHaveLength(1);
    expect(round1.playerA.words[0].word).toBe("búr");
    expect(round1.playerB.delta).toBe(15);
    expect(round1.playerB.cumulative).toBe(15);
    expect(round1.playerB.words).toHaveLength(1);
    expect(round1.playerB.words[0].word).toBe("lag");

    const round2 = result[1];
    expect(round2.roundNumber).toBe(2);
    expect(round2.playerA.delta).toBe(18);
    expect(round2.playerA.cumulative).toBe(38);
    expect(round2.playerA.words).toHaveLength(1);
    expect(round2.playerB.words).toHaveLength(0);
  });

  it("T004: round with no words — playerA and playerB word arrays are empty", () => {
    const words: WordHistoryRow[] = [];
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1, playerAScore: 0, playerBScore: 0, playerADelta: 0, playerBDelta: 0 }),
    ];

    const result = deriveRoundHistory(words, scores, "player-a", "Player A", "player-b", "Player B");

    expect(result).toHaveLength(1);
    expect(result[0].playerA.words).toHaveLength(0);
    expect(result[0].playerB.words).toHaveLength(0);
  });

  it("T004: entries are ordered by round number ascending", () => {
    const words: WordHistoryRow[] = [
      makeWord({ roundNumber: 3, playerId: "player-a" }),
      makeWord({ roundNumber: 1, playerId: "player-a" }),
      makeWord({ roundNumber: 2, playerId: "player-a" }),
    ];
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1 }),
      makeScore({ roundNumber: 2 }),
      makeScore({ roundNumber: 3 }),
    ];

    const result = deriveRoundHistory(words, scores, "player-a", "Player A", "player-b", "Player B");

    expect(result.map((r) => r.roundNumber)).toEqual([1, 2, 3]);
  });
});
