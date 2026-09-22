import { BOARD_SIZE } from "@/lib/constants/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";
import { Language } from "@/lib/types/game-config";

const WORDLIST_DIR = "data/wordlists";

/** The shortest and longest word a board list keeps, in letters. */
export interface WordLengths {
  min: number;
  max: number;
}

/**
 * The lengths the game can score: nothing shorter than the minimum word
 * length, nothing longer than a row or column of the board.
 */
export const BOARD_WORD_LENGTHS: WordLengths = {
  min: DEFAULT_GAME_CONFIG.minimumWordLength,
  max: BOARD_SIZE,
};

/** The full list a language's board lists are built from (e.g. BÍN for `is`). */
export function sourceWordlistPath(language: Language): string {
  return `${WORDLIST_DIR}/word_list_${language}.txt`;
}

/**
 * The list the game loads: the source stripped of every word the game cannot
 * score, `word_list_<min>_<max>_<lang>.txt`. Built by `pnpm wordlists:build`.
 */
export function boardWordlistPath(language: Language, lengths: WordLengths): string {
  return `${WORDLIST_DIR}/word_list_${lengths.min}_${lengths.max}_${language}.txt`;
}

/**
 * Keep only the entries of `min`..`max` letters, lowercased and NFC-normalized
 * (the form `lookupWord` queries), without blanks or duplicates. Length counts
 * code points, so a multi-byte letter like `þ` is one letter.
 */
export function filterWordsForBoard(lines: string[], lengths: WordLengths): string[] {
  const words = new Set<string>();
  for (const line of lines) {
    const word = line.trim().normalize("NFC").toLowerCase();
    const length = [...word].length;
    if (length >= lengths.min && length <= lengths.max) {
      words.add(word);
    }
  }
  return [...words];
}
