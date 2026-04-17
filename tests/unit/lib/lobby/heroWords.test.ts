import { describe, expect, test } from "vitest";

import { HERO_WORDS } from "@/lib/lobby/heroWords";

const ICELANDIC_SPECIALS = new Set(["Þ", "Æ", "Ð", "Ö"]);

function hasSpecialLetter(word: { letters: string[] }): boolean {
  return word.letters.some((g) => ICELANDIC_SPECIALS.has(g));
}

describe("HERO_WORDS", () => {
  test("includes ORÐUSTA marked as product name", () => {
    const entry = HERO_WORDS.find(
      (w) => w.letters.join("") === "ORÐUSTA",
    );
    expect(entry).toBeDefined();
    expect(entry?.isProductName).toBe(true);
  });

  test("contains at least three additional Icelandic nouns with special letters", () => {
    const extras = HERO_WORDS.filter(
      (w) => !w.isProductName && hasSpecialLetter(w),
    );
    expect(extras.length).toBeGreaterThanOrEqual(3);
  });

  test("each word has 4-8 letters (grapheme-aware)", () => {
    for (const w of HERO_WORDS) {
      expect(w.letters.length).toBeGreaterThanOrEqual(4);
      expect(w.letters.length).toBeLessThanOrEqual(8);
    }
  });

  test("each locale is 'is'", () => {
    for (const w of HERO_WORDS) {
      expect(w.locale).toBe("is");
    }
  });

  test("Icelandic special letters survive as single graphemes (not split)", () => {
    const orduSta = HERO_WORDS.find((w) =>
      w.letters.includes("Ð"),
    );
    expect(orduSta?.letters.some((g) => g === "Ð")).toBe(true);
  });
});
