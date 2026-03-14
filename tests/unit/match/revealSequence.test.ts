import { describe, expect, it } from "vitest";

import { deriveRevealSequence } from "@/lib/match/revealSequence";
import type { RoundSummary } from "@/lib/types/match";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function makeSummary(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    matchId: "match-1",
    roundNumber: 1,
    words: [],
    deltas: { playerA: 0, playerB: 0 },
    totals: { playerA: 0, playerB: 0 },
    highlights: [],
    resolvedAt: new Date().toISOString(),
    moves: [],
    ...overrides,
  };
}

describe("deriveRevealSequence", () => {
  it("sorts moves by submittedAt ascending", () => {
    const summary = makeSummary({
      moves: [
        { playerId: PLAYER_B, from: { x: 3, y: 3 }, to: { x: 4, y: 3 }, submittedAt: "2026-01-01T00:00:00.200Z" },
        { playerId: PLAYER_A, from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, submittedAt: "2026-01-01T00:00:00.100Z" },
      ],
    });

    const result = deriveRevealSequence(summary);

    expect(result.orderedMoves[0].playerId).toBe(PLAYER_A);
    expect(result.orderedMoves[1].playerId).toBe(PLAYER_B);
  });

  it("returns per-player highlight coordinates from summary.words", () => {
    const summary = makeSummary({
      moves: [
        { playerId: PLAYER_A, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, submittedAt: "2026-01-01T00:00:00.100Z" },
        { playerId: PLAYER_B, from: { x: 5, y: 5 }, to: { x: 6, y: 5 }, submittedAt: "2026-01-01T00:00:00.200Z" },
      ],
      words: [
        {
          playerId: PLAYER_A,
          word: "ab",
          length: 2,
          lettersPoints: 5,
          bonusPoints: 0,
          totalPoints: 5,
          coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        },
        {
          playerId: PLAYER_B,
          word: "cd",
          length: 2,
          lettersPoints: 4,
          bonusPoints: 0,
          totalPoints: 4,
          coordinates: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
        },
      ],
    });

    const result = deriveRevealSequence(summary);

    const coordsA = result.highlightsFor(PLAYER_A);
    expect(coordsA).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);

    const coordsB = result.highlightsFor(PLAYER_B);
    expect(coordsB).toEqual([{ x: 5, y: 5 }, { x: 6, y: 5 }]);
  });

  it("returns per-player score delta from summary.words", () => {
    const summary = makeSummary({
      moves: [
        { playerId: PLAYER_A, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, submittedAt: "2026-01-01T00:00:00.100Z" },
        { playerId: PLAYER_B, from: { x: 5, y: 5 }, to: { x: 6, y: 5 }, submittedAt: "2026-01-01T00:00:00.200Z" },
      ],
      words: [
        {
          playerId: PLAYER_A,
          word: "ab",
          length: 2,
          lettersPoints: 5,
          bonusPoints: 0,
          totalPoints: 5,
          coordinates: [],
        },
        {
          playerId: PLAYER_A,
          word: "abc",
          length: 3,
          lettersPoints: 10,
          bonusPoints: 5,
          totalPoints: 15,
          coordinates: [],
        },
        {
          playerId: PLAYER_B,
          word: "cd",
          length: 2,
          lettersPoints: 4,
          bonusPoints: 0,
          totalPoints: 4,
          coordinates: [],
        },
      ],
    });

    const result = deriveRevealSequence(summary);

    expect(result.deltaFor(PLAYER_A)).toBe(20); // 5 + 15
    expect(result.deltaFor(PLAYER_B)).toBe(4);
  });

  it("handles single-move summary — only one orderedMove returned", () => {
    const summary = makeSummary({
      moves: [
        { playerId: PLAYER_A, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, submittedAt: "2026-01-01T00:00:00.100Z" },
      ],
    });

    const result = deriveRevealSequence(summary);

    expect(result.orderedMoves).toHaveLength(1);
    expect(result.orderedMoves[0].playerId).toBe(PLAYER_A);
  });

  it("returns empty highlights and zero delta for a player with no words", () => {
    const summary = makeSummary({
      moves: [
        { playerId: PLAYER_A, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, submittedAt: "2026-01-01T00:00:00.100Z" },
      ],
      words: [],
    });

    const result = deriveRevealSequence(summary);

    expect(result.highlightsFor(PLAYER_A)).toEqual([]);
    expect(result.deltaFor(PLAYER_A)).toBe(0);
  });
});
