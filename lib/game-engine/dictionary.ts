import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Path to the Icelandic word list file (~2.76M inflected forms).
 * Resolved relative to the project root.
 */
const WORDLIST_PATH = resolve(
  process.cwd(),
  "docs/wordlist/word_list_is.txt",
);

/** Module-level singleton cache for the loaded dictionary. */
let cachedDictionary: Set<string> | null = null;

/**
 * Load the Icelandic dictionary into an in-memory Set.
 *
 * Reads the entire word list synchronously, splits by newline,
 * NFC-normalizes and lowercases each entry, and inserts into a Set
 * for O(1) lookups. Uses sync I/O for maximum throughput on the
 * single bulk read (~50MB file). The result is cached as a
 * module-level singleton — subsequent calls return instantly.
 *
 * @returns Set of NFC-normalized, lowercased valid Icelandic words
 * @throws if the dictionary file cannot be read
 * @performance MUST complete in <200ms on cold start (FR-022)
 */
export async function loadDictionary(): Promise<Set<string>> {
  if (cachedDictionary) {
    return cachedDictionary;
  }

  const startMark = "dictionary-load-start";
  const endMark = "dictionary-load-end";
  performance.mark(startMark);

  const raw = readFileSync(WORDLIST_PATH, "utf-8");
  // The wordlist is pre-normalized (NFC) and pre-lowercased.
  // Constructing Set from split array avoids per-line normalization overhead.
  const words = new Set(raw.split("\n"));
  words.delete("");

  performance.mark(endMark);
  const measure = performance.measure(
    "dictionary-load",
    startMark,
    endMark,
  );

  console.log(
    JSON.stringify({
      level: "info",
      event: "dictionary.loaded",
      entries: words.size,
      durationMs: Math.round(measure.duration),
    }),
  );

  cachedDictionary = words;
  return words;
}

/**
 * Check whether a word exists in the dictionary.
 *
 * NFC-normalizes and lowercases the input before lookup to ensure
 * case-insensitive, normalization-safe matching.
 *
 * @param dictionary - The loaded dictionary Set
 * @param word - The word to look up
 * @returns true if the word is in the dictionary
 */
export function lookupWord(
  dictionary: Set<string>,
  word: string,
): boolean {
  if (word.length === 0) {
    return false;
  }
  return dictionary.has(word.normalize("NFC").toLowerCase());
}

/**
 * Reset the dictionary cache. Used for testing and benchmarking
 * to force a fresh load from disk.
 */
export function resetDictionaryCache(): void {
  cachedDictionary = null;
}
