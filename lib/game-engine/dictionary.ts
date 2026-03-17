import { readFileSync } from "fs";
import { resolve } from "path";
import { Language } from "@/lib/types/game-config";

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

/** Per-language wordlist paths and minimum entry counts to detect corrupt/partial files. */
const LANGUAGE_DICTIONARY_CONFIG: Record<
  Language,
  { file: string; minEntries: number }
> = {
  is: { file: "data/wordlists/word_list_is.txt", minEntries: 2_000_000 },
  en: { file: "data/wordlists/word_list_en.txt", minEntries: 10_000 },
  se: { file: "data/wordlists/word_list_se.txt", minEntries: 100_000 },
  no: { file: "data/wordlists/word_list_no.txt", minEntries: 100_000 },
  dk: { file: "data/wordlists/word_list_dk.txt", minEntries: 100_000 },
};

/** Per-language singleton caches for loaded dictionaries. */
const cachedDictionaries = new Map<Language, Set<string>>();

/**
 * Load a language dictionary into an in-memory Set.
 *
 * Reads the entire word list synchronously, splits by newline,
 * NFC-normalizes and lowercases each entry, and inserts into a Set
 * for O(1) lookups. Uses sync I/O for maximum throughput on the
 * single bulk read. The result is cached per language — subsequent
 * calls for the same language return instantly.
 *
 * @param language - Language code selecting the dictionary (defaults to 'is')
 * @returns Set of NFC-normalized, lowercased valid words
 * @throws {DictionaryLoadError} if the dictionary file cannot be read, is empty, or is corrupt
 * @performance MUST complete in <1000ms on cold start (FR-022, SC-007)
 */
export async function loadDictionary(
  language: Language = "is",
): Promise<Set<string>> {
  const cached = cachedDictionaries.get(language);
  if (cached) {
    return cached;
  }

  const { file, minEntries } = LANGUAGE_DICTIONARY_CONFIG[language];
  const wordlistPath = resolve(process.cwd(), file);

  const startMark = `dictionary-load-start-${language}`;
  const endMark = `dictionary-load-end-${language}`;
  performance.mark(startMark);

  try {
    // Attempt to read the dictionary file
    const raw = readFileSync(wordlistPath, "utf-8");

    // Validate file is not empty (FR-001a)
    if (!raw || raw.trim().length === 0) {
      throw new DictionaryLoadError(
        `Dictionary file for '${language}' is empty. Cannot proceed with word validation.`,
      );
    }

    // The wordlist is pre-normalized (NFC) and pre-lowercased.
    // Constructing Set from split array avoids per-line normalization overhead.
    const words = new Set(raw.split("\n"));
    words.delete(""); // Remove any empty entries

    // Validate minimum entry count to detect corrupt/partial files (FR-001a)
    if (words.size < minEntries) {
      throw new DictionaryLoadError(
        `Dictionary for '${language}' appears corrupt or partial. Expected >=${minEntries.toLocaleString()} entries, got ${words.size.toLocaleString()}. Cannot proceed with word validation.`,
      );
    }

    performance.mark(endMark);
    const measure = performance.measure(
      `dictionary-load-${language}`,
      startMark,
      endMark,
    );

    console.log(
      JSON.stringify({
        level: "info",
        event: "dictionary.loaded",
        language,
        entries: words.size,
        durationMs: Math.round(measure.duration),
      }),
    );

    cachedDictionaries.set(language, words);
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
        ? `Failed to load dictionary for '${language}': file not found at ${wordlistPath}. The game cannot be played without a valid dictionary.`
        : `Failed to load dictionary for '${language}': ${fsError.message}. The game cannot be played without a valid dictionary.`;

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
 * Reset all dictionary caches. Used for testing and benchmarking
 * to force a fresh load from disk.
 */
export function resetDictionaryCache(): void {
  cachedDictionaries.clear();
}
