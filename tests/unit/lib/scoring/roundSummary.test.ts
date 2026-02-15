import { describe, expect, it, vi } from "vitest";

import { aggregateRoundSummary, calculateWordScore } from "@/lib/scoring/roundSummary";
import type { WordScore } from "@/lib/types/match";

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
    // M=2, I=1, S=1, T=1 → lettersPoints = 5
    expect(result).toEqual(
      expect.objectContaining({
        word: "mist",
        length: 4,
        lettersPoints: 5,
        bonusPoints: 10,
        totalPoints: 15,
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
    });

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
});

