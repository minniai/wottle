import { beforeEach, describe, expect, test } from "vitest";
import {
  loadDictionary,
  lookupWord,
  resetDictionaryCache,
} from "@/lib/game-engine/dictionary";

// Curation overlay for the raw BÍN word list (Linear O-69, O-70, O-81):
// exclusions remove BÍN entries players rejected as real words, additions
// patch coverage gaps in the extraction.
describe("dictionary curation overlay (is)", () => {
  beforeEach(() => {
    resetDictionaryCache();
  });

  test("excluded BÍN noise no longer validates", async () => {
    const dict = await loadDictionary("is");
    // O-81: sýs is in raw BÍN but rejected as a playable word
    expect(lookupWord(dict, "sýs")).toBe(false);
    // O-69: ílæti is in raw BÍN but rejected as a playable word
    expect(lookupWord(dict, "ílæti")).toBe(false);
  });

  test("added words missing from the BÍN extraction validate", async () => {
    const dict = await loadDictionary("is");
    // O-70: the kóla (cola) paradigm is absent from the raw extraction
    expect(lookupWord(dict, "kóla")).toBe(true);
    expect(lookupWord(dict, "kólu")).toBe(true);
    expect(lookupWord(dict, "KÓLU")).toBe(true);
  });

  test("base list entries are unaffected by the overlay", async () => {
    const dict = await loadDictionary("is");
    expect(lookupWord(dict, "hús")).toBe(true);
    expect(lookupWord(dict, "ólæti")).toBe(true);
  });

  test("overlay files tolerate comments and blank lines", async () => {
    const dict = await loadDictionary("is");
    // A "# comment" line must never become a dictionary entry
    expect(lookupWord(dict, "# o-81: not a playable word")).toBe(false);
  });
});
