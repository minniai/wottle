import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeAll, describe, expect, test } from "vitest";

import {
  BOARD_WORD_LENGTHS,
  boardWordlistPath,
  filterWordsForBoard,
  sourceWordlistPath,
} from "@/lib/game-engine/boardWordlist";
import { loadDictionary, resetDictionaryCache } from "@/lib/game-engine/dictionary";

function readLines(path: string): string[] {
  return readFileSync(resolve(process.cwd(), path), "utf-8").split("\n");
}

describe("board wordlist paths", () => {
  test("names the board wordlist by minimum and maximum length and language", () => {
    expect(boardWordlistPath("is", { min: 3, max: 10 })).toBe(
      "data/wordlists/word_list_3_10_is.txt",
    );
    expect(boardWordlistPath("en", { min: 2, max: 12 })).toBe(
      "data/wordlists/word_list_2_12_en.txt",
    );
  });

  test("takes the lengths from the game: 3-letter minimum, 10-letter board", () => {
    expect(BOARD_WORD_LENGTHS).toEqual({ min: 3, max: 10 });
  });

  test("names the full source wordlist by language", () => {
    expect(sourceWordlistPath("is")).toBe("data/wordlists/word_list_is.txt");
  });
});

describe("filterWordsForBoard", () => {
  const lengths = { min: 3, max: 10 };

  test("keeps words no longer than the board and drops longer ones", () => {
    expect(filterWordsForBoard(["hús", "abcdefghij", "abcdefghijk"], lengths)).toEqual([
      "hús",
      "abcdefghij",
    ]);
  });

  test("drops words shorter than the minimum word length", () => {
    expect(filterWordsForBoard(["á", "ás", "ást"], lengths)).toEqual(["ást"]);
  });

  test("counts letters, not UTF-16 units or bytes", () => {
    // ten Icelandic letters, several of them multi-byte in UTF-8
    expect(filterWordsForBoard(["þóðæöáéíúý"], lengths)).toEqual(["þóðæöáéíúý"]);
  });

  test("normalizes to lowercase NFC, drops blanks and duplicates", () => {
    const decomposed = "hu\u0301s";
    expect(filterWordsForBoard(["", "  ", "Hús", decomposed, "hús"], lengths)).toEqual([
      "hús",
    ]);
  });
});

describe("the committed board wordlist", () => {
  test("matches the source filtered to the board size", () => {
    const built = readLines(boardWordlistPath("is", BOARD_WORD_LENGTHS)).filter(Boolean);
    const expected = filterWordsForBoard(
      readLines(sourceWordlistPath("is")),
      BOARD_WORD_LENGTHS,
    );
    expect(built.length).toBe(expected.length);
    expect(built).toEqual(expected);
  });
});

describe("loadDictionary on the board wordlist", () => {
  let dict: Set<string>;

  beforeAll(async () => {
    resetDictionaryCache();
    dict = await loadDictionary("is");
  });

  test("holds only words between the minimum length and the board size", () => {
    const { min, max } = BOARD_WORD_LENGTHS;
    for (const word of dict) {
      const length = [...word].length;
      if (length < min || length > max) {
        throw new Error(`'${word}' has ${length} letters, outside ${min}..${max}`);
      }
    }
  });

  test("still holds words that fit the board", () => {
    expect(dict.has("hestur")).toBe(true);
    expect(dict.size).toBeGreaterThan(1_000_000);
  });
});
