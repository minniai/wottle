import { describe, expect, it } from "vitest";

import { bandMap, mapLetters } from "@/lib/pages/bandMap";

/** Spec 070 US2.4 (T049): the last match as bands on a 10×10 grid of rules. */
describe("bandMap", () => {
  it("draws each word as a band inset per §5.2 in the field's units, with its chevron", () => {
    const [band] = bandMap([{ tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], seat: "you" }]);
    expect(band.seat).toBe("you");
    expect(band.rect).toMatchObject({ x: 0.5, y: 2, w: 29, h: 6 });
    expect(band.chevron).toMatch(/^M/);
  });

  it("reads the direction from the order of the tiles: a word read upwards starts at the bottom", () => {
    const [down] = bandMap([{ tiles: [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }], seat: "opp" }]);
    const [up] = bandMap([{ tiles: [{ x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }], seat: "opp" }]);
    expect(down.edge).toBe("top");
    expect(up.edge).toBe("bottom");
  });

  it("skips a band whose tiles are not a straight line", () => {
    expect(bandMap([{ tiles: [{ x: 0, y: 0 }, { x: 1, y: 1 }], seat: "you" }])).toEqual([]);
  });
});

/** 2026-09-25: the last match as it ended, its letters on the grid. */
describe("mapLetters", () => {
  const board = Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => String.fromCharCode(65 + ((x + y) % 26))));

  it("places every letter of the final board, unscored ones with no seat", () => {
    const letters = mapLetters(board, []);
    expect(letters).toHaveLength(100);
    expect(letters[12]).toEqual({ x: 2, y: 1, letter: "D", seat: null });
  });

  it("gives a scored letter the colour of the player who froze it first", () => {
    const letters = mapLetters(board, [
      { tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], seat: "you" },
      { tiles: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }], seat: "opp" },
    ]);
    expect(letters.find((l) => l.x === 2 && l.y === 0)?.seat).toBe("you");
    expect(letters.find((l) => l.x === 2 && l.y === 2)?.seat).toBe("opp");
    expect(letters.find((l) => l.x === 5 && l.y === 5)?.seat).toBeNull();
  });

  it("draws no letters without a board", () => {
    expect(mapLetters(null, [])).toEqual([]);
  });
});
