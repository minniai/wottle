import { describe, expect, test } from "vitest";

import {
  ICELANDIC_LETTER_WEIGHTS,
  generateBoard,
  getLetterWeights,
} from "../../../../scripts/supabase/generateBoard";

const LETTERS = Object.keys(ICELANDIC_LETTER_WEIGHTS);

describe("generateBoard", () => {
  test("produces a 16x16 grid populated with letters", () => {
    const board = generateBoard({ matchId: "alpha" });

    expect(board).toHaveLength(16);
    for (const row of board) {
      expect(row).toHaveLength(16);
      for (const cell of row) {
        expect(LETTERS).toContain(cell);
      }
    }
  });

  test("includes every alphabet character at least once", () => {
    const board = generateBoard({ matchId: "coverage" });
    const seen = new Set(board.flat());

    for (const letter of LETTERS) {
      expect(seen.has(letter)).toBe(true);
    }
  });

  test("is deterministic for the same match id", () => {
    const boardA = generateBoard({ matchId: "stable-seed" });
    const boardB = generateBoard({ matchId: "stable-seed" });

    expect(boardA).toEqual(boardB);
  });

  test("differs when match id changes", () => {
    const boardA = generateBoard({ matchId: "seed-a" });
    const boardB = generateBoard({ matchId: "seed-b" });

    expect(boardA).not.toEqual(boardB);
  });

  test("respects weighting priority across large samples", () => {
    const weights = getLetterWeights();
    const sorted = [...Object.entries(weights)].sort((a, b) => b[1] - a[1]);
    const [mostCommon, , , , leastCommon] = [
      sorted[0],
      sorted[1],
      sorted[2],
      sorted[3],
      sorted.at(-1),
    ];

    const tallies: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const board = generateBoard({ matchId: `weighted-${i}` });
      for (const letter of board.flat()) {
        tallies[letter] = (tallies[letter] ?? 0) + 1;
      }
    }

    expect(tallies[mostCommon[0]] ?? 0).toBeGreaterThan(tallies[leastCommon?.[0] ?? ""] ?? 0);
  });
});

