import { describe, expect, it } from "vitest";

import { applyLetterSwaps } from "@/lib/room/displayBoard";

describe("applyLetterSwaps", () => {
  const board = [["A", "B"], ["C", "D"]];
  it("returns the same reference when there is nothing to apply", () => {
    expect(applyLetterSwaps(board, [null, undefined])).toBe(board);
  });
  it("applies swaps in order without mutating the input", () => {
    const out = applyLetterSwaps(board, [[{ x: 0, y: 0 }, { x: 1, y: 1 }], [{ x: 1, y: 0 }, { x: 0, y: 0 }]]);
    expect(out).toEqual([["B", "D"], ["C", "A"]]);
    expect(board).toEqual([["A", "B"], ["C", "D"]]);
  });
  it("ignores out-of-range coordinates", () => {
    expect(applyLetterSwaps(board, [[{ x: 9, y: 9 }, { x: 0, y: 0 }]])).toEqual(board);
  });
});
