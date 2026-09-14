import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
  ICELANDIC_LETTER_WEIGHTS,
  diffBoards,
  generateBoard,
} from "@/lib/game-engine/boardGenerator";
import { BOARD_SIZE } from "@/lib/constants/board";

describe("boardGenerator (pure)", () => {
  test("same seed produces the same grid", () => {
    expect(generateBoard({ seed: "alpha" })).toEqual(generateBoard({ seed: "alpha" }));
    expect(generateBoard({ seed: "alpha" })).not.toEqual(generateBoard({ seed: "beta" }));
  });

  test("every alphabet letter appears at least once", () => {
    const cells = generateBoard({ seed: "gamma" }).flat();
    for (const letter of Object.keys(ICELANDIC_LETTER_WEIGHTS)) {
      expect(cells).toContain(letter);
    }
    expect(cells).toHaveLength(BOARD_SIZE * BOARD_SIZE);
  });

  test("diffBoards returns only the coordinates whose letter differs", () => {
    const a = generateBoard({ seed: "delta" });
    const b = a.map((row) => [...row]);
    b[3][7] = b[3][7] === "A" ? "B" : "A";
    b[9][0] = b[9][0] === "Þ" ? "Ð" : "Þ";
    expect(diffBoards(a, b)).toEqual([
      { x: 7, y: 3 },
      { x: 0, y: 9 },
    ]);
    expect(diffBoards(a, a)).toEqual([]);
  });

  test("module is browser-safe (no node: imports)", () => {
    const source = readFileSync("lib/game-engine/boardGenerator.ts", "utf8");
    expect(source).not.toMatch(/from ["']node:/);
  });
});
