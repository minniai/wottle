import { describe, expect, test } from "vitest";

import type { WordScore, RoundSummary } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";

/**
 * FR-019: Round summary broadcast payload MUST remain under 100KB.
 *
 * Given the 10x10 board and typical word counts per round, this limit
 * is unlikely to be reached in normal play. This test validates a
 * worst-case scenario to ensure the constraint holds.
 */
describe("FR-019: round summary broadcast payload size", () => {
  test("worst-case round summary serializes under 100KB", () => {
    // Worst case: both players each score 10 long words (14 letters)
    // with maximum coordinate arrays — far beyond typical play
    const makeWord = (playerId: string, index: number): WordScore => ({
      playerId,
      word: "þjóðleikhúsið".repeat(1).slice(0, 14),
      length: 14,
      lettersPoints: 50,
      bonusPoints: 60,
      totalPoints: 110,
      coordinates: Array.from(
        { length: 14 },
        (_, j): Coordinate => ({
          x: (index * 14 + j) % 10,
          y: Math.floor((index * 14 + j) / 10) % 10,
        }),
      ),
    });

    const words: WordScore[] = [
      ...Array.from({ length: 10 }, (_, i) => makeWord("player-a-id", i)),
      ...Array.from({ length: 10 }, (_, i) =>
        makeWord("player-b-id", i + 10),
      ),
    ];

    const payload: RoundSummary = {
      matchId: "00000000-0000-0000-0000-000000000000",
      roundNumber: 10,
      words,
      totals: { playerA: 999, playerB: 999 },
      deltas: { playerA: 500, playerB: 500 },
      highlights: words.map((w) => w.coordinates),
      resolvedAt: new Date().toISOString(),
    };

    const serialized = JSON.stringify(payload);
    const sizeKB = Buffer.byteLength(serialized, "utf-8") / 1024;

    expect(sizeKB).toBeLessThan(100);
  });

  test("typical round summary is well under 10KB", () => {
    // Typical case: each player scores 1-2 words of 4-6 letters
    const words: WordScore[] = [
      {
        playerId: "player-a-id",
        word: "hestur",
        length: 6,
        lettersPoints: 18,
        bonusPoints: 20,
        totalPoints: 38,
        coordinates: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 4, y: 0 },
          { x: 5, y: 0 },
        ],
        },
      {
        playerId: "player-b-id",
        word: "búr",
        length: 3,
        lettersPoints: 12,
        bonusPoints: 5,
        totalPoints: 17,
        coordinates: [
          { x: 7, y: 3 },
          { x: 8, y: 3 },
          { x: 9, y: 3 },
        ],
        },
    ];

    const payload: RoundSummary = {
      matchId: "00000000-0000-0000-0000-000000000000",
      roundNumber: 3,
      words,
      totals: { playerA: 78, playerB: 42 },
      deltas: { playerA: 38, playerB: 17 },
      highlights: words.map((w) => w.coordinates),
      resolvedAt: new Date().toISOString(),
    };

    const serialized = JSON.stringify(payload);
    const sizeKB = Buffer.byteLength(serialized, "utf-8") / 1024;

    expect(sizeKB).toBeLessThan(10);
  });
});
