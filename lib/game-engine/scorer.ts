import { LETTER_SCORING_VALUES_IS } from "@/docs/wordlist/letter_scoring_values_is";

/**
 * Calculate the sum of letter point values for a word.
 *
 * Uppercases each character and looks up its value in the provided
 * letter scoring table. Unknown characters default to 1.
 *
 * @param word - The word to score (any case)
 * @param letterValues - Letter-to-point map for the active language (defaults to Icelandic)
 * @returns Sum of letter values
 */
export function calculateLetterPoints(
  word: string,
  letterValues: Record<string, number> = LETTER_SCORING_VALUES_IS,
): number {
  let total = 0;
  for (const char of word) {
    const upper = char.toUpperCase();
    const value = letterValues[upper] ?? 1;
    total += value;
  }
  return total;
}

/**
 * Calculate the length bonus for a word.
 *
 * PRD formula: (word_length - 2) * 5
 *
 * @param wordLength - Number of letters in the word (≥2)
 * @returns Length bonus points
 */
export function calculateLengthBonus(wordLength: number): number {
  return (wordLength - 2) * 5;
}
