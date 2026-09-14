import { describe, expect, test } from "vitest";

import {
  InvalidWordGeometryError,
  deriveReadingDirection,
  tryDeriveReadingDirection,
} from "@/lib/game-engine/readingDirection";

describe("deriveReadingDirection (rules §3.1 / §12)", () => {
  test.each([
    ["ltr", [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }]],
    ["rtl", [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]],
    ["ttb", [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]],
    ["btt", [{ x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }]],
  ] as const)("%s from the first step", (expected, coords) => {
    expect(deriveReadingDirection([...coords])).toBe(expected);
  });

  test("throws for fewer than two tiles", () => {
    expect(() => deriveReadingDirection([{ x: 0, y: 0 }])).toThrow(InvalidWordGeometryError);
  });

  test("throws for a diagonal step", () => {
    expect(() => deriveReadingDirection([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow(
      InvalidWordGeometryError,
    );
  });

  test("try variant returns undefined instead of throwing", () => {
    expect(tryDeriveReadingDirection([])).toBeUndefined();
    expect(tryDeriveReadingDirection([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe("ltr");
  });
});
