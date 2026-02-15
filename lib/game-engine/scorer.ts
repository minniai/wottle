import { LETTER_SCORING_VALUES_IS } from "@/docs/wordlist/letter_scoring_values_is";

type LetterKey = keyof typeof LETTER_SCORING_VALUES_IS;

/**
 * Calculate the sum of letter point values for a word.
 *
 * Uppercases each character and looks up its value in the
 * Icelandic letter scoring table. Unknown characters default to 1.
 *
 * @param word - The word to score (any case)
 * @returns Sum of letter values
 */
export function calculateLetterPoints(word: string): number {
  let total = 0;
  for (const char of word) {
    const upper = char.toUpperCase() as LetterKey;
    const value = LETTER_SCORING_VALUES_IS[upper] ?? 1;
    total += value;
  }
  return total;
}

/**
 * Calculate the length bonus for a word.
 *
 * PRD formula: (word_length - 2) * 5
 *
 * @param wordLength - Number of letters in the word (≥3)
 * @returns Length bonus points
 */
export function calculateLengthBonus(wordLength: number): number {
  return (wordLength - 2) * 5;
}

/**
 * Calculate the combo bonus for multiple words in a round.
 *
 * PRD formula: 1→+0, 2→+2, 3→+5, 4+→+7+(n-4)
 * Only non-duplicate words count toward the combo.
 *
 * @param newWordCount - Number of non-duplicate words scored this round
 * @returns Combo bonus points
 */
export function calculateComboBonus(newWordCount: number): number {
  if (newWordCount <= 1) return 0;
  if (newWordCount === 2) return 2;
  if (newWordCount === 3) return 5;
  return 7 + (newWordCount - 4);
}
