import { describe, expect, test } from "vitest";
import { calculateLetterPoints, calculateLengthBonus, calculateMoveScore } from "@/lib/game-engine/scorer";
import type { AttributedWord } from "@/lib/game-engine/word-finder";

describe("scorer cross-word updates", () => {
  test("calculates points appropriately for individual words", () => {
    // We mock Icelandic values roughly, or just assert it's a number > 0
    expect(calculateLetterPoints("cat")).toBeGreaterThan(0); 
  });

  test("calculates score for multiple crossing words simultaneously", () => {
    const words: AttributedWord[] = [
      { text: "cat", displayText: "cat", direction: "right", start: { x: 0, y: 0 }, length: 3, tiles: [] },
      { text: "car", displayText: "car", direction: "down", start: { x: 0, y: 0 }, length: 3, tiles: [] }
    ];

    const score = calculateMoveScore(words);
    // Score should be the sum of letter points and length bonuses for BOTH words
    const baseCat = calculateLetterPoints("cat") + calculateLengthBonus(3);
    const baseCar = calculateLetterPoints("car") + calculateLengthBonus(3);
    expect(score).toEqual(baseCat + baseCar);
  });
});
