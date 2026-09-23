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

  test("I7a (2026-09-23): when BORÐAGILT is a word, it scores as one word and GILT alone is still refused", () => {
    const dictionary = new Set(["borða", "gilt", "borðagilt"]);
    const gilt = hWord("gilt", 6, 2);
    expect(selectOptimalCombination([gilt], board(), FROZEN_BORDA, dictionary, "player_b")).toEqual([]);
    const result = selectOptimalCombination([gilt, hWord("borðagilt", 1, 2)], board(), FROZEN_BORDA, dictionary, "player_b");
    expect(result.map((w) => w.text)).toEqual(["borðagilt"]);
  });

  test("accepts GILT when a free tile separates it from BORÐA", () => {
    const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "z")) as BoardGrid;
    "borðazgilt".split("").forEach((ch, x) => {
      grid[3][x] = ch;
    });
    const frozen: FrozenTileMap = Object.fromEntries(
      [0, 1, 2, 3, 4].map((x) => [`${x},3`, { owner: "player_a" as const }]),
    );
    const dictionary = new Set(["borða", "gilt"]);
    const result = selectOptimalCombination([hWord("gilt", 6, 3)], grid, frozen, dictionary, "player_b");
    expect(result.map((w) => w.text)).toEqual(["gilt"]);
  });
});
