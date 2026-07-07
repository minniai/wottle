import { describe, expect, test } from "vitest";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

// Regression guard: commit 166ecf7 silently changed Æ 4→6 and added C/Z,
// diverging from the sanctioned Krafla distribution (game_rules §5.1).
describe("LETTER_SCORING_VALUES_IS (Krafla distribution)", () => {
  test("matches the sanctioned Krafla tournament values exactly", () => {
    expect(LETTER_SCORING_VALUES_IS).toEqual({
      A: 1,
      Á: 3,
      B: 5,
      D: 5,
      Ð: 2,
      E: 3,
      É: 7,
      F: 3,
      G: 3,
      H: 4,
      I: 1,
      Í: 4,
      J: 6,
      K: 2,
      L: 2,
      M: 2,
      N: 1,
      O: 5,
      Ó: 3,
      P: 5,
      R: 1,
      S: 1,
      T: 2,
      U: 2,
      Ú: 4,
      V: 5,
      X: 10,
      Y: 6,
      Ý: 5,
      Þ: 7,
      Æ: 4,
      Ö: 6,
    });
  });

  test("covers the full 32-letter Icelandic alphabet and nothing else", () => {
    const letters = Object.keys(LETTER_SCORING_VALUES_IS);
    expect(letters).toHaveLength(32);
    expect(letters).not.toContain("C");
    expect(letters).not.toContain("Q");
    expect(letters).not.toContain("W");
    expect(letters).not.toContain("Z");
  });
});
