import { describe, expect, test } from "vitest";

import { selectOptimalCombination } from "@/lib/game-engine/crossValidator";
import type { BoardGrid, BoardWord } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

function board(): BoardGrid {
  const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "z")) as BoardGrid;
  "borðagilt".split("").forEach((ch, i) => {
    grid[2][1 + i] = ch;
  });
  return grid;
}

function hWord(text: string, startX: number, y: number): BoardWord {
  const tiles = Array.from({ length: text.length }, (_, i) => ({ x: startX + i, y }));
  return { text, displayText: text.toUpperCase(), direction: "right", start: tiles[0], length: text.length, tiles };
}

/** BORÐA frozen at columns 1–5 of row 2 (a prior horizontal word). */
const FROZEN_BORDA: FrozenTileMap = Object.fromEntries(
  [1, 2, 3, 4, 5].map((x) => [`${x},2`, { owner: "player_a" as const, scoredAxes: ["horizontal" as const] }]),
);

/**
 * Rules §3.5a whole-run rule, design example: two bands of the same axis never
 * touch end to end. Pinned for spec 044.
 */
describe("§3.5a BORÐA + GILT", () => {
  test("rejects GILT abutting frozen BORÐA when BORÐAGILT is not a word", () => {
    const dictionary = new Set(["borða", "gilt"]);
    const result = selectOptimalCombination([hWord("gilt", 6, 2)], board(), FROZEN_BORDA, dictionary, "player_b");
    expect(result).toEqual([]);
  });

  test("accepts GILT when the whole combined run BORÐAGILT is itself a word", () => {
    const dictionary = new Set(["borða", "gilt", "borðagilt"]);
    const result = selectOptimalCombination([hWord("gilt", 6, 2)], board(), FROZEN_BORDA, dictionary, "player_b");
    expect(result.map((w) => w.text)).toEqual(["gilt"]);
  });

  test("accepts GILT when a free tile separates it from BORÐA", () => {
    const grid = board();
    grid[2][6] = "z";
    "gilt".split("").forEach((ch, i) => {
      grid[2][7 + i] = ch;
    });
    const dictionary = new Set(["borða", "gilt"]);
    const result = selectOptimalCombination([hWord("gilt", 7, 2)], grid, FROZEN_BORDA, dictionary, "player_b");
    expect(result.map((w) => w.text)).toEqual(["gilt"]);
  });
});
