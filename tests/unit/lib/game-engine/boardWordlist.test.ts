import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeAll, describe, expect, test } from "vitest";

import { BOARD_SIZE } from "@/lib/constants/board";
import {
  boardWordlistPath,
  filterWordsForBoard,
  sourceWordlistPath,
} from "@/lib/game-engine/boardWordlist";
import { loadDictionary, resetDictionaryCache } from "@/lib/game-engine/dictionary";

function readLines(path: string): string[] {
  return readFileSync(resolve(process.cwd(), path), "utf-8").split("\n");
}

describe("board wordlist paths", () => {
  test("names the board wordlist by board size and language", () => {
    expect(boardWordlistPath("is", 10)).toBe("data/wordlists/word_list_10_is.txt");
    expect(boardWordlistPath("en", 12)).toBe("data/wordlists/word_list_12_en.txt");
  });

  test("names the full source wordlist by language", () => {
    expect(sourceWordlistPath("is")).toBe("data/wordlists/word_list_is.txt");
  });
});

describe("filterWordsForBoard", () => {
  test("keeps words no longer than the board and drops longer ones", () => {
    expect(filterWordsForBoard(["hús", "abcdefghij", "abcdefghijk"], 10)).toEqual([
      "hús",
      "abcdefghij",
    ]);
  });

  test("counts letters, not UTF-16 units or bytes", () => {
    // ten Icelandic letters, several of them multi-byte in UTF-8
    expect(filterWordsForBoard(["þóðæöáéíúý"], 10)).toEqual(["þóðæöáéíúý"]);
  });

  test("normalizes to lowercase NFC, drops blanks and duplicates", () => {
    const decomposed = "hús";
    expect(filterWordsForBoard(["", "  ", "Hús", decomposed, "hús"], 10)).toEqual([
      "hús",
    ]);
  });
});

describe("the committed board wordlist", () => {
  test("matches the source filtered to the board size", () => {
    const built = readLines(boardWordlistPath("is", BOARD_SIZE)).filter(Boolean);
    const expected = filterWordsForBoard(readLines(sourceWordlistPath("is")), BOARD_SIZE);
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

  test("holds no word longer than the board", () => {
    for (const word of dict) {
      if ([...word].length > BOARD_SIZE) {
        throw new Error(`'${word}' is longer than the ${BOARD_SIZE}-letter board`);
      }
    }
  });

  test("still holds words that fit the board", () => {
    expect(dict.has("hestur")).toBe(true);
    expect(dict.size).toBeGreaterThan(1_000_000);
  });
});
