import { describe, expect, test } from "vitest";

import { ICELANDIC_LETTER_WEIGHTS } from "@/lib/game-engine/boardGenerator";
import { ALL_LETTERS, getLanguagePack, UnsupportedLanguageError } from "@/lib/game-engine/languagePack";
import { LETTER_SCORING_VALUES_EN } from "@/lib/game-engine/letter-values/letter_scoring_values_en";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import { generateBoard } from "@/lib/game-engine/boardGenerator";

describe("language pack (spec 060)", () => {
  test("Icelandic is exactly today's game: weights, values, uppercase", () => {
    const is = getLanguagePack("is");
    expect(is.letterWeights).toEqual(ICELANDIC_LETTER_WEIGHTS);
    expect(is.letterValues).toBe(LETTER_SCORING_VALUES_IS);
    expect(is.upperLocale).toBe("is");
    expect(is.alphabet).toHaveLength(32);
  });

  test("English plays 26 letters with English values", () => {
    const en = getLanguagePack("en");
    expect(en.alphabet).toHaveLength(26);
    expect([...en.alphabet].sort().join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(en.letterValues).toBe(LETTER_SCORING_VALUES_EN);
    expect(en.upperLocale).toBe("en");
  });

  test("an English board holds only English letters, and each at least once", () => {
    const grid = generateBoard({ seed: "en-board", weights: getLanguagePack("en").letterWeights });
    const letters = new Set(grid.flat());
    for (const letter of letters) expect(letter).toMatch(/^[A-Z]$/);
    expect(letters.size).toBe(26);
  });

  test("a language with no pack yet is refused, not silently Icelandic", () => {
    expect(() => getLanguagePack("dk")).toThrow(UnsupportedLanguageError);
  });

  test("every playable letter is in the union the schemas accept", () => {
    for (const letter of [...getLanguagePack("is").alphabet, ...getLanguagePack("en").alphabet]) {
      expect(ALL_LETTERS.has(letter)).toBe(true);
    }
  });
});
