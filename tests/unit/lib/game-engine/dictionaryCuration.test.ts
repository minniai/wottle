import { beforeEach, describe, expect, test } from "vitest";
import {
  loadDictionary,
  lookupWord,
  resetDictionaryCache,
} from "@/lib/game-engine/dictionary";

// Exclusions overlay for the raw BÍN word list (Linear O-81): the dictionary
// accepts BÍN entries and nothing else — exclusions remove BÍN noise players
// rejected as real words; there is deliberately no additions mechanism.
describe("dictionary exclusions overlay (is)", () => {
  beforeEach(() => {
    resetDictionaryCache();
  });

  test("excluded BÍN noise no longer validates", async () => {
    const dict = await loadDictionary("is");
    // O-81: sýs is in raw BÍN but rejected as a playable word
    expect(lookupWord(dict, "sýs")).toBe(false);
  });

  test("base list entries are unaffected by the overlay", async () => {
    const dict = await loadDictionary("is");
    expect(lookupWord(dict, "hús")).toBe(true);
    expect(lookupWord(dict, "ólæti")).toBe(true);
    // O-69: ílæti is a real BÍN word, distinct from the non-words
    // itæli/ilæti — it must keep validating
    expect(lookupWord(dict, "ílæti")).toBe(true);
    expect(lookupWord(dict, "ÍLÆTI")).toBe(true);
  });

  test("accent-stripped variants of real words never validate", async () => {
    const dict = await loadDictionary("is");
    // O-69: í and i are distinct letters — ilæti/itæli are not words
    expect(lookupWord(dict, "ilæti")).toBe(false);
    expect(lookupWord(dict, "itæli")).toBe(false);
    expect(lookupWord(dict, "ítæli")).toBe(false);
  });

  test("only BÍN entries validate — no additions mechanism", async () => {
    const dict = await loadDictionary("is");
    // kóla/kólu are absent from the BÍN extraction, so they must not score;
    // a missing real word is fixed upstream in the wordlist, never added here
    expect(lookupWord(dict, "kóla")).toBe(false);
    expect(lookupWord(dict, "kólu")).toBe(false);
  });

  test("exclusions file tolerates comments and blank lines", async () => {
    const dict = await loadDictionary("is");
    // A "# comment" line must never become a dictionary entry
    expect(lookupWord(dict, "# o-81: not a playable word")).toBe(false);
  });
});
