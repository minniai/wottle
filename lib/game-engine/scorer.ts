import { LETTER_SCORING_VALUES_IS } from "@/docs/wordlist/letter_scoring_values_is";
import type { AttributedWord } from "@/lib/game-engine/word-finder";

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

/**
 * Calculates the total score for a valid move by summing the points
 * of all extracted cross-words.
 */
export function calculateMoveScore(words: AttributedWord[]): number {
  if (words.length === 0) return 0;

  let totalScore = 0;
  for (const word of words) {
    const lettersPoints = calculateLetterPoints(word.text);
    const lengthBonus = calculateLengthBonus(word.length);
    totalScore += lettersPoints + lengthBonus;
  }

  // Can also apply calculateComboBonus based on unique words if needed, but per the PRD combo bonus
  // is calculated at the round level for *all* words played by the player, not just one move.
  // For now, calculateMoveScore just aggregates base + length.
  
  return totalScore;
}
