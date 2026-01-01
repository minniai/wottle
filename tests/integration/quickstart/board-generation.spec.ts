import { describe, expect, test } from "vitest";

import { generateBoard, getLetterWeights } from "@/scripts/supabase/generateBoard";

describe("quickstart board generation guard", () => {
  test("each board contains every Icelandic letter", () => {
    const weights = getLetterWeights();
    for (let i = 0; i < 5; i++) {
      const board = generateBoard({ matchId: `integration-${i}` });
      const seen = new Set(board.flat());
      for (const letter of Object.keys(weights)) {
        expect(seen.has(letter)).toBe(true);
      }
    }
  });

  test("weighted sampling favours common letters across boards", () => {
    const tallies: Record<string, number> = {};
    const weights = getLetterWeights();
    const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const topLetter = entries[0]?.[0];
    const bottomLetter = entries.at(-1)?.[0];

    for (let i = 0; i < 30; i++) {
      for (const letter of generateBoard({ matchId: `weighted-${i}` }).flat()) {
        tallies[letter] = (tallies[letter] ?? 0) + 1;
      }
    }

    expect(topLetter).toBeDefined();
    expect(bottomLetter).toBeDefined();

    if (topLetter && bottomLetter) {
      expect(tallies[topLetter] ?? 0).toBeGreaterThan(tallies[bottomLetter] ?? 0);
    }
  });
});

