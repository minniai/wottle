import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

/** Spec 060 research R7: the English list is data the engine can trust. */
const words = readFileSync(resolve(__dirname, "../../../../data/wordlists/word_list_en.txt"), "utf-8")
  .split("\n")
  .filter(Boolean);

describe("English word list", () => {
  test("is lowercase a–z only", () => {
    expect(words.filter((w) => !/^[a-z]+$/.test(w))).toEqual([]);
  });

  test("is large enough and holds common words", () => {
    expect(words.length).toBeGreaterThanOrEqual(10_000);
    for (const w of ["cat", "house", "tree", "word"]) expect(words).toContain(w);
  });
});
