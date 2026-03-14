import { describe, expect, it, vi } from "vitest";

import { aggregateRoundSummary, calculateWordScore } from "@/lib/scoring/roundSummary";
import type { WordScore, RoundMove } from "@/lib/types/match";

describe("roundSummary scoring utilities", () => {
  it("calculates letter and bonus points for a word", () => {
    const coordinates = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];

    const result = calculateWordScore("mist", coordinates);

    // PRD formula: bonusPoints = (length - 2) * 5 = (4-2)*5 = 10
    // M=2, I=1, S=1, T=2 → lettersPoints = 6
    expect(result).toEqual(
      expect.objectContaining({
        word: "mist",
        length: 4,
        lettersPoints: 6,
        bonusPoints: 10,
        totalPoints: 16,
        coordinates,
      }),
    );
  });

  it("aggregates round summary totals and highlights", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const words: WordScore[] = [
      {
        playerId: "player-a",
        word: "HRAUN",
        length: 5,
        lettersPoints: 12,
        bonusPoints: 2,
        totalPoints: 14,
        coordinates: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 4, y: 0 },
        ],
      },
      {
        playerId: "player-b",
        word: "ÖLD",
        length: 3,
        lettersPoints: 11,
        bonusPoints: 0,
        totalPoints: 11,
        coordinates: [
          { x: 5, y: 5 },
          { x: 6, y: 5 },
          { x: 7, y: 5 },
        ],
      },
    ];

    const summary = aggregateRoundSummary("match-1", 3, words, {
      playerA: 20,
      playerB: 18,
    }, "player-a", "player-b");

    expect(summary).toEqual(
      expect.objectContaining({
        matchId: "match-1",
        roundNumber: 3,
        deltas: { playerA: 14, playerB: 11 },
        totals: { playerA: 34, playerB: 29 },
        highlights: [
          words[0].coordinates,
          words[1].coordinates,
        ],
        words,
      }),
    );
    expect(summary.resolvedAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("correctly attributes score when only player_b scores in a round", () => {
    // Regression: without actual player IDs, player_b's words would be
    // mistakenly assigned to internal 'playerA' and added to player_a_score.
    const words: WordScore[] = [
      {
        playerId: "player-b",
        word: "ÖLD",
        length: 3,
        lettersPoints: 11,
        bonusPoints: 5,
        totalPoints: 16,
        coordinates: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
      },
    ];

    const summary = aggregateRoundSummary(
      "match-1",
      2,
      words,
      { playerA: 20, playerB: 0 },
      "player-a",
      "player-b",
    );

    expect(summary.deltas).toEqual({ playerA: 0, playerB: 16 });
    expect(summary.totals).toEqual({ playerA: 20, playerB: 16 });
  });

  it("correctly attributes score when only player_a scores in a round", () => {
    const words: WordScore[] = [
      {
        playerId: "player-a",
        word: "HRAUN",
        length: 5,
        lettersPoints: 12,
        bonusPoints: 15,
        totalPoints: 27,
        coordinates: [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
          { x: 3, y: 0 }, { x: 4, y: 0 },
        ],
      },
    ];

    const summary = aggregateRoundSummary(
      "match-1",
      2,
      words,
      { playerA: 0, playerB: 30 },
      "player-a",
      "player-b",
    );

    expect(summary.deltas).toEqual({ playerA: 27, playerB: 0 });
    expect(summary.totals).toEqual({ playerA: 27, playerB: 30 });
  });

  it("includes moves in aggregated round summary", () => {
    const moves: RoundMove[] = [
      { playerId: "player-a", from: { x: 2, y: 3 }, to: { x: 4, y: 3 }, submittedAt: "2026-01-01T00:00:00.000Z" },
      { playerId: "player-b", from: { x: 7, y: 1 }, to: { x: 7, y: 2 }, submittedAt: "2026-01-01T00:00:01.000Z" },
    ];

    const summary = aggregateRoundSummary(
      "match-1",
      1,
      [],
      { playerA: 0, playerB: 0 },
      "player-a",
      "player-b",
      moves,
    );

    expect(summary.moves).toEqual(moves);
  });
});
