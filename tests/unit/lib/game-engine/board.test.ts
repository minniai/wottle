import { describe, expect, test } from "vitest";

import {
  applySwap,
  assertCoordinate,
  cloneGrid,
  deserializeGrid,
  serializeGrid,
} from "@/lib/game-engine/board";
import { BASELINE_GRID } from "@/scripts/supabase/constants";
import { BOARD_MAX_INDEX } from "@/lib/constants/board";

function makeTestGrid(): string[][] {
  return BASELINE_GRID.map((row) => [...row]);
}

describe("board utilities", () => {
  test("cloneGrid returns a deep copy of the provided board grid", () => {
    const original = makeTestGrid();
    const cloned = cloneGrid(original);

    expect(cloned).not.toBe(original);
    expect(cloned).toEqual(original);
    expect(cloned[0]).not.toBe(original[0]);
  });

  test("applySwap returns a new grid with swapped coordinates without mutating the input", () => {
    const grid = makeTestGrid();
    const snapshot = cloneGrid(grid);
    const move = {
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    } as const;

    const result = applySwap(grid, move);

    expect(result).not.toBe(grid);
    expect(result[move.from.y][move.from.x]).toBe(snapshot[move.to.y][move.to.x]);
    expect(result[move.to.y][move.to.x]).toBe(snapshot[move.from.y][move.from.x]);
    expect(grid).toEqual(snapshot);
  });

  test("applySwap rejects swaps that keep the same coordinate", () => {
    const grid = makeTestGrid();

    expect(() =>
      applySwap(grid, { from: { x: 3, y: 3 }, to: { x: 3, y: 3 } })
    ).toThrowError(/swap a tile with itself/i);
  });

  test("assertCoordinate enforces in-bounds coordinates", () => {
    expect(() => assertCoordinate({ x: -1, y: 0 })).toThrow();
    expect(() => assertCoordinate({ x: 0, y: BOARD_MAX_INDEX + 1 })).toThrow();
    expect(() => assertCoordinate({ x: BOARD_MAX_INDEX, y: BOARD_MAX_INDEX })).not.toThrow();
  });

  test("serializeGrid and deserializeGrid perform a lossless round trip", () => {
    const grid = makeTestGrid();
    const serialized = serializeGrid(grid);
    const restored = deserializeGrid(serialized);

    expect(restored).toEqual(grid);
  });

  test("deserializeGrid rejects malformed input", () => {
    expect(() => deserializeGrid("ABC")).toThrow();
  });
});

