import { Language } from "@/lib/types/game-config";

const WORDLIST_DIR = "data/wordlists";

/** The full list a language's board lists are built from (e.g. BÍN for `is`). */
export function sourceWordlistPath(language: Language): string {
  return `${WORDLIST_DIR}/word_list_${language}.txt`;
}

/**
 * The list the game loads: the source stripped of every word that cannot fit
 * on a board of `boardSize` letters. Built by `pnpm wordlists:build`.
 */
export function boardWordlistPath(language: Language, boardSize: number): string {
  return `${WORDLIST_DIR}/word_list_${boardSize}_${language}.txt`;
}

/**
 * Keep only the entries a `boardSize` board can spell, lowercased and
 * NFC-normalized (the form `lookupWord` queries), without blanks or duplicates.
 * Length counts code points, so a multi-byte letter like `þ` is one letter.
 */
export function filterWordsForBoard(lines: string[], boardSize: number): string[] {
  const words = new Set<string>();
  for (const line of lines) {
    const word = line.trim().normalize("NFC").toLowerCase();
    if (word.length > 0 && [...word].length <= boardSize) {
      words.add(word);
    }
  }
  return [...words];
}
