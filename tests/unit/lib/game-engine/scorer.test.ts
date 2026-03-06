import { describe, expect, test } from "vitest";
import {
  calculateLetterPoints,
  calculateLengthBonus,
} from "@/lib/game-engine/scorer";

describe("scorer", () => {
  test("calculates letter points for a word", () => {
    expect(calculateLetterPoints("cat")).toBeGreaterThan(0);
  });

  test("calculates length bonus for 3-letter word", () => {
    expect(calculateLengthBonus(3)).toBe(5);
  });

  test("calculates length bonus for 5-letter word", () => {
    expect(calculateLengthBonus(5)).toBe(15);
  });

  test("2-letter word has zero length bonus (FR-004)", () => {
    expect(calculateLengthBonus(2)).toBe(0);
  });

  test("2-letter word scores letter points only", () => {
    const letters = calculateLetterPoints("ás");
    expect(letters).toBeGreaterThan(0);
    expect(calculateLengthBonus(2)).toBe(0);
  });
});
