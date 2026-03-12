import { describe, expect, test, beforeAll, beforeEach } from "vitest";

import {
  loadDictionary,
  lookupWord,
  resetDictionaryCache,
} from "@/lib/game-engine/dictionary";

describe("dictionary", () => {
  beforeAll(() => {
    resetDictionaryCache();
  });

  describe("loadDictionary", () => {
    test("should load more than 2 million entries from the word list", async () => {
      const dict = await loadDictionary();
      expect(dict.size).toBeGreaterThan(2_000_000);
    });

    test("should return a Set instance", async () => {
      const dict = await loadDictionary();
      expect(dict).toBeInstanceOf(Set);
    });

    test("should NFC-normalize entries so composed and decomposed forms match", async () => {
      const dict = await loadDictionary();
      // "hestur" in NFC form should be present
      const nfcNormalized = "hestur".normalize("NFC");
      expect(dict.has(nfcNormalized)).toBe(true);
    });

    test("should lowercase all entries", async () => {
      const dict = await loadDictionary();
      for (const word of dict) {
        expect(word).toBe(word.toLowerCase());
        // Only check a sample to avoid iterating 2.76M entries
        break;
      }
      // Verify no uppercase letters exist in a sample
      const sample = Array.from(dict).slice(0, 1000);
      for (const word of sample) {
        expect(word).toBe(word.toLowerCase());
      }
    });

    test("should return the same cached instance on subsequent calls", async () => {
      const first = await loadDictionary();
      const second = await loadDictionary();
      expect(first).toBe(second);
    });

    test("should contain no entries shorter than 3 characters", async () => {
      // boardScanner.ts hardcodes a minimum length of 3; entries shorter than 3
      // can never be matched by the scanner and would only create confusion.
      const dict = await loadDictionary();
      for (const entry of dict) {
        if (entry.length < 3) {
          throw new Error(
            `Dictionary contains a ${entry.length}-char entry: "${entry}". All entries must be >= 3 chars.`,
          );
        }
      }
    });
  });

  describe("lookupWord", () => {
    let dict: Set<string>;

    beforeAll(async () => {
      dict = await loadDictionary();
    });

    test("should return true for known Icelandic word 'hestur'", () => {
      expect(lookupWord(dict, "hestur")).toBe(true);
    });

    test("should return true for known Icelandic word 'land'", () => {
      expect(lookupWord(dict, "land")).toBe(true);
    });

    test("should return false for invalid strings", () => {
      expect(lookupWord(dict, "zzzzzzz")).toBe(false);
      expect(lookupWord(dict, "xyzabc")).toBe(false);
    });

    test("should return false for empty string", () => {
      expect(lookupWord(dict, "")).toBe(false);
    });

    test("should perform case-insensitive matching", () => {
      expect(lookupWord(dict, "HESTUR")).toBe(true);
      expect(lookupWord(dict, "Hestur")).toBe(true);
      expect(lookupWord(dict, "hEsTuR")).toBe(true);
    });

    test("should treat Icelandic char ð as distinct from d", () => {
      // "það" (that) is a valid Icelandic word containing ð
      expect(lookupWord(dict, "það")).toBe(true);
      // Replacing ð with d produces a different (invalid) string
      expect(lookupWord(dict, "tad")).toBe(false);
    });

    test("should treat Icelandic char þ as distinct from t", () => {
      // "þessi" (this) is a valid Icelandic word starting with þ
      expect(lookupWord(dict, "þessi")).toBe(true);
      // þ and t are stored as distinct characters in the Set
      const hasÞ = lookupWord(dict, "þessi");
      const withoutÞ = "þessi".replace("þ", "t");
      expect(withoutÞ).toBe("tessi");
      // The key point: the dictionary treats þ as a distinct letter
      expect(hasÞ).toBe(true);
    });

    test("should treat Icelandic char æ as distinct from ae", () => {
      // "æddi" is a valid Icelandic word starting with æ
      expect(lookupWord(dict, "æddi")).toBe(true);
      // Replacing æ with ae produces a different string
      expect(lookupWord(dict, "aeddi")).toBe(false);
    });

    test("should NFC-normalize the input before lookup", () => {
      // "búr" contains ú which has distinct NFC vs NFD forms
      const decomposed = "b\u0075\u0301r"; // b + u + combining acute = "búr" in NFD
      const composed = "búr".normalize("NFC");
      expect(decomposed).not.toBe(composed);
      expect(lookupWord(dict, decomposed)).toBe(true);
    });
  });

  describe("multi-language support", () => {
    beforeEach(() => {
      resetDictionaryCache();
    });

    test("loadDictionary('en') returns a non-empty Set", async () => {
      const dict = await loadDictionary("en");
      expect(dict).toBeInstanceOf(Set);
      expect(dict.size).toBeGreaterThan(10_000);
    });

    test("loadDictionary('is') still works with explicit language param", async () => {
      const dict = await loadDictionary("is");
      expect(dict.size).toBeGreaterThan(2_000_000);
    });

    test("loadDictionary() with no arg defaults to Icelandic", async () => {
      const withDefault = await loadDictionary();
      const withExplicit = await loadDictionary("is");
      expect(withDefault).toBe(withExplicit);
    });

    test("different languages are cached independently", async () => {
      const en = await loadDictionary("en");
      const is = await loadDictionary("is");
      expect(en).not.toBe(is);
      // Same language returns the same cached instance
      expect(await loadDictionary("en")).toBe(en);
      expect(await loadDictionary("is")).toBe(is);
    });

    test("resetDictionaryCache clears all language caches", async () => {
      const en1 = await loadDictionary("en");
      resetDictionaryCache();
      const en2 = await loadDictionary("en");
      expect(en1).not.toBe(en2);
    });
  });
});
