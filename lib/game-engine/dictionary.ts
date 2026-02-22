import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Custom error thrown when dictionary loading fails.
 * Wraps the underlying file system or validation error with context.
 */
export class DictionaryLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "DictionaryLoadError";
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DictionaryLoadError.prototype);
  }
}

/**
 * Path to the Icelandic word list file (~2.76M inflected forms).
 * Resolved relative to the project root.
 */
const WORDLIST_PATH = resolve(
  process.cwd(),
  "docs/wordlist/word_list_is.txt",
);

/** Minimum expected dictionary entries (2M words) to detect corrupt/partial files */
const MIN_DICTIONARY_ENTRIES = 2_000_000;

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
 * @throws {DictionaryLoadError} if the dictionary file cannot be read, is empty, or is corrupt
 * @performance MUST complete in <1000ms on cold start (FR-022, SC-007)
 */
export async function loadDictionary(): Promise<Set<string>> {
  if (cachedDictionary) {
    return cachedDictionary;
  }

  const startMark = "dictionary-load-start";
  const endMark = "dictionary-load-end";
  performance.mark(startMark);

  try {
    // Attempt to read the dictionary file
    const raw = readFileSync(WORDLIST_PATH, "utf-8");

    // Validate file is not empty (FR-001a)
    if (!raw || raw.trim().length === 0) {
      throw new DictionaryLoadError(
        "Dictionary file is empty. Cannot proceed with word validation.",
      );
    }

    // The wordlist is pre-normalized (NFC) and pre-lowercased.
    // Constructing Set from split array avoids per-line normalization overhead.
    const words = new Set(raw.split("\n"));
    words.delete(""); // Remove any empty entries

    // Validate minimum entry count to detect corrupt/partial files (FR-001a)
    if (words.size < MIN_DICTIONARY_ENTRIES) {
      throw new DictionaryLoadError(
        `Dictionary appears corrupt or partial. Expected >=${MIN_DICTIONARY_ENTRIES.toLocaleString()} entries, got ${words.size.toLocaleString()}. Cannot proceed with word validation.`,
      );
    }

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
  } catch (error) {
    // If already a DictionaryLoadError, re-throw as-is
    if (error instanceof DictionaryLoadError) {
      throw error;
    }

    // Wrap file system errors with context (FR-001a)
    const fsError = error as NodeJS.ErrnoException;
    const errorMessage =
      fsError.code === "ENOENT"
        ? `Failed to load dictionary: file not found at ${WORDLIST_PATH}. The game cannot be played without a valid dictionary.`
        : `Failed to load dictionary: ${fsError.message}. The game cannot be played without a valid dictionary.`;

    throw new DictionaryLoadError(errorMessage, fsError);
  }
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
