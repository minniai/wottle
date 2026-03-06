import { describe, expect, it } from "vitest";
import { deriveBiggestSwing, deriveHighestScoringWord } from "@/components/match/deriveCallouts";
import type { ScoreboardRow, WordHistoryRow } from "@/components/match/FinalSummary";

function makeScore(overrides: Partial<ScoreboardRow> = {}): ScoreboardRow {
  return {
    roundNumber: 1,
    playerAScore: 0,
    playerBScore: 0,
    playerADelta: 0,
    playerBDelta: 0,
    ...overrides,
  };
}

function makeWord(overrides: Partial<WordHistoryRow> = {}): WordHistoryRow {
  return {
    roundNumber: 1,
    playerId: "player-a",
    word: "búr",
    totalPoints: 20,
    lettersPoints: 15,
    bonusPoints: 5,
    coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    ...overrides,
  };
}

describe("deriveBiggestSwing", () => {
  it("T005: identifies round with largest absolute delta difference", () => {
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1, playerADelta: 20, playerBDelta: 5 }),   // swing = 15
      makeScore({ roundNumber: 2, playerADelta: 5,  playerBDelta: 30 }),  // swing = 25
      makeScore({ roundNumber: 3, playerADelta: 10, playerBDelta: 10 }),  // swing = 0
    ];

    const result = deriveBiggestSwing(scores);

    expect(result).not.toBeNull();
    expect(result!.roundNumber).toBe(2);
    expect(result!.swingAmount).toBe(25);
    expect(result!.favoredPlayerId).toBe("player-b");
  });

  it("T005: tiebreaker — earlier round wins when swing amounts are equal", () => {
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1, playerADelta: 10, playerBDelta: 0 }),  // swing = 10
      makeScore({ roundNumber: 2, playerADelta: 0,  playerBDelta: 10 }), // swing = 10
    ];

    const result = deriveBiggestSwing(scores);

    expect(result!.roundNumber).toBe(1);
  });

  it("T005: returns null when all rounds have zero scoring", () => {
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1, playerADelta: 0, playerBDelta: 0 }),
      makeScore({ roundNumber: 2, playerADelta: 0, playerBDelta: 0 }),
    ];

    const result = deriveBiggestSwing(scores);

    expect(result).toBeNull();
  });

  it("T005: returns null for empty scoreboard", () => {
    expect(deriveBiggestSwing([])).toBeNull();
  });

  it("T005: favors playerA when playerA delta is higher", () => {
    const scores: ScoreboardRow[] = [
      makeScore({ roundNumber: 1, playerADelta: 30, playerBDelta: 5 }),
    ];

    const result = deriveBiggestSwing(scores);

    expect(result!.favoredPlayerId).toBe("player-a");
  });
});

describe("deriveHighestScoringWord", () => {
  const usernameMap = { "player-a": "Alice", "player-b": "Bob" };

  it("T005: returns the word with the highest total points", () => {
    const words: WordHistoryRow[] = [
      makeWord({ word: "búr", totalPoints: 20, playerId: "player-a", roundNumber: 1 }),
      makeWord({ word: "glæsilegur", totalPoints: 80, playerId: "player-b", roundNumber: 2 }),
      makeWord({ word: "lag", totalPoints: 15, playerId: "player-a", roundNumber: 3 }),
    ];

    const result = deriveHighestScoringWord(words, usernameMap);

    expect(result).not.toBeNull();
    expect(result!.word).toBe("glæsilegur");
    expect(result!.totalPoints).toBe(80);
    expect(result!.playerId).toBe("player-b");
    expect(result!.username).toBe("Bob");
    expect(result!.roundNumber).toBe(2);
  });

  it("T005: filters out zero-point words from consideration", () => {
    const words: WordHistoryRow[] = [
      makeWord({ word: "búr", totalPoints: 0, roundNumber: 1 }),
      makeWord({ word: "lag", totalPoints: 15, roundNumber: 2 }),
    ];

    const result = deriveHighestScoringWord(words, usernameMap);

    expect(result!.word).toBe("lag");
    expect(result!.totalPoints).toBe(15);
  });

  it("T005: tiebreaker — earlier round wins when points are equal", () => {
    const words: WordHistoryRow[] = [
      makeWord({ word: "fár", totalPoints: 20, roundNumber: 2, playerId: "player-a" }),
      makeWord({ word: "búr", totalPoints: 20, roundNumber: 1, playerId: "player-b" }),
    ];

    const result = deriveHighestScoringWord(words, usernameMap);

    expect(result!.word).toBe("búr");
    expect(result!.roundNumber).toBe(1);
  });

  it("T005: tiebreaker — same round, alphabetical username wins", () => {
    const words: WordHistoryRow[] = [
      makeWord({ word: "fár", totalPoints: 20, roundNumber: 1, playerId: "player-b" }),  // Bob
      makeWord({ word: "búr", totalPoints: 20, roundNumber: 1, playerId: "player-a" }),  // Alice
    ];

    const result = deriveHighestScoringWord(words, usernameMap);

    // Alice < Bob alphabetically
    expect(result!.username).toBe("Alice");
    expect(result!.word).toBe("búr");
  });

  it("T005: returns null when all words have zero points", () => {
    const words: WordHistoryRow[] = [
      makeWord({ totalPoints: 0 }),
    ];

    const result = deriveHighestScoringWord(words, usernameMap);

    expect(result).toBeNull();
  });

  it("T005: returns null for empty word list", () => {
    expect(deriveHighestScoringWord([], usernameMap)).toBeNull();
  });
});
