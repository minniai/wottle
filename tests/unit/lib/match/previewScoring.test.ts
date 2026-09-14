import { describe, expect, test } from "vitest";

import { priceSwap } from "@/lib/match/previewScoring";
import type { BoardGrid } from "@/lib/types/board";

function board(fill = "z"): BoardGrid {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => fill)) as BoardGrid;
}

describe("priceSwap (spec 044 R2)", () => {
  const dictionary = new Set(["hestur"]);

  test("prices the words a swap would form without mutating the input board", () => {
    const grid = board();
    ["r", "e", "s", "t", "u", "h"].forEach((ch, i) => {
      grid[0][i] = ch;
    });
    const snapshot = JSON.stringify(grid);

    const price = priceSwap({
      board: grid,
      from: { x: 0, y: 0 },
      to: { x: 5, y: 0 },
      frozenTiles: {},
      playerSlot: "player_a",
      dictionary,
    });

    expect(price.words).toEqual([{ word: "hestur", points: expect.any(Number), direction: "ltr" }]);
    expect(price.words[0].points).toBeGreaterThan(0);
    expect(price.total).toBe(price.words[0].points);
    expect(JSON.stringify(grid)).toBe(snapshot);
  });

  test("returns zero words and total 0 when nothing forms", () => {
    const price = priceSwap({
      board: board(),
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      frozenTiles: {},
      playerSlot: "player_a",
      dictionary,
    });
    expect(price).toEqual({ words: [], total: 0 });
  });

  test("opponent-frozen letters inside the word do not count toward letter points", () => {
    const grid = board();
    ["r", "e", "s", "t", "u", "h"].forEach((ch, i) => {
      grid[0][i] = ch;
    });
    const unfrozen = priceSwap({ board: grid, from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, frozenTiles: {}, playerSlot: "player_a", dictionary });
    const frozen = priceSwap({
      board: grid,
      from: { x: 0, y: 0 },
      to: { x: 5, y: 0 },
      frozenTiles: { "2,0": { owner: "player_b" } },
      playerSlot: "player_a",
      dictionary,
    });
    expect(frozen.total).toBeLessThan(unfrozen.total);
  });
});
