import { describe, expect, test } from "vitest";

import {
  calculateLetterPoints,
  calculateLengthBonus,
  calculateComboBonus,
} from "@/lib/game-engine/scorer";

describe("scorer", () => {
  describe("calculateLetterPoints", () => {
    test("should sum letter values correctly for 'BÚR' (B=4 + Ú=7 + R=1 = 12)", () => {
      expect(calculateLetterPoints("búr")).toBe(12);
    });

    test("should sum letter values correctly for 'HESTUR'", () => {
      // H=3, E=2, S=1, T=1, U=1, R=1 = 9
      expect(calculateLetterPoints("hestur")).toBe(9);
    });

    test("should sum letter values correctly for 'LAND'", () => {
      // L=1, A=1, N=1, D=3 = 6
      expect(calculateLetterPoints("land")).toBe(6);
    });

    test("should handle all 32 Icelandic letters", () => {
      // Each letter maps to a specific value
      const expected: Record<string, number> = {
        a: 1, á: 4, b: 4, d: 3, ð: 2, e: 2, é: 9, f: 3,
        g: 2, h: 3, i: 1, í: 7, j: 4, k: 2, l: 1, m: 2,
        n: 1, o: 5, ó: 4, p: 5, r: 1, s: 1, t: 1, u: 1,
        ú: 7, v: 3, x: 10, y: 6, ý: 8, þ: 8, æ: 6, ö: 6,
      };

      for (const [letter, value] of Object.entries(expected)) {
        expect(calculateLetterPoints(letter)).toBe(value);
      }
    });

    test("should handle uppercase input by converting to uppercase for lookup", () => {
      expect(calculateLetterPoints("búr")).toBe(
        calculateLetterPoints("BÚR"),
      );
    });
  });

  describe("calculateLengthBonus", () => {
    test("should return (length - 2) * 5 for all valid lengths", () => {
      expect(calculateLengthBonus(3)).toBe(5); // (3-2)*5
      expect(calculateLengthBonus(4)).toBe(10); // (4-2)*5
      expect(calculateLengthBonus(5)).toBe(15); // (5-2)*5
      expect(calculateLengthBonus(6)).toBe(20); // (6-2)*5
      expect(calculateLengthBonus(7)).toBe(25); // (7-2)*5
      expect(calculateLengthBonus(8)).toBe(30); // (8-2)*5
      expect(calculateLengthBonus(9)).toBe(35); // (9-2)*5
      expect(calculateLengthBonus(10)).toBe(40); // (10-2)*5
    });
  });

  describe("calculateComboBonus", () => {
    test("should return 0 for 1 word", () => {
      expect(calculateComboBonus(1)).toBe(0);
    });

    test("should return 2 for 2 words", () => {
      expect(calculateComboBonus(2)).toBe(2);
    });

    test("should return 5 for 3 words", () => {
      expect(calculateComboBonus(3)).toBe(5);
    });

    test("should return 7 for 4 words", () => {
      expect(calculateComboBonus(4)).toBe(7);
    });

    test("should return 8 for 5 words (7 + (5-4))", () => {
      expect(calculateComboBonus(5)).toBe(8);
    });

    test("should return 9 for 6 words (7 + (6-4))", () => {
      expect(calculateComboBonus(6)).toBe(9);
    });

    test("should return 0 for 0 words", () => {
      expect(calculateComboBonus(0)).toBe(0);
    });
  });
});
