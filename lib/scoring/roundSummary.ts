import type { WordScore } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";
import type { Language } from "@/lib/types/game-config";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import { LETTER_SCORING_VALUES_EN } from "@/lib/game-engine/letter-values/letter_scoring_values_en";
import { LETTER_SCORING_VALUES_SE } from "@/lib/game-engine/letter-values/letter_scoring_values_se";
import { LETTER_SCORING_VALUES_NO } from "@/lib/game-engine/letter-values/letter_scoring_values_no";
import { LETTER_SCORING_VALUES_DK } from "@/lib/game-engine/letter-values/letter_scoring_values_dk";

const LETTER_SCORING_BY_LANGUAGE: Record<Language, Record<string, number>> = {
    is: LETTER_SCORING_VALUES_IS,
    en: LETTER_SCORING_VALUES_EN,
    se: LETTER_SCORING_VALUES_SE,
    no: LETTER_SCORING_VALUES_NO,
    dk: LETTER_SCORING_VALUES_DK,
};

/**
 * Calculate points for a single word based on letters and bonuses.
 * This is a simplified scoring implementation for the playtest.
 * Full implementation would include length bonuses, combo bonuses, etc.
 */
export function calculateWordScore(word: string, coordinates: Coordinate[], language: Language = "is"): Omit<WordScore, "playerId"> {
    const length = word.length;
    const letterValues = LETTER_SCORING_BY_LANGUAGE[language];

    // Calculate letter points
    let lettersPoints = 0;
    for (const letter of word.toUpperCase()) {
        const value = letterValues[letter] ?? 1;
        lettersPoints += value;
    }

    // PRD-compliant length bonus: (word_length - 2) * 5
    const bonusPoints = (length - 2) * 5;

    const totalPoints = lettersPoints + bonusPoints;

    return {
        word,
        length,
        lettersPoints,
        bonusPoints,
        totalPoints,
        coordinates,
    };
}

/**
 * Aggregate word scores for a round and compute cumulative totals.
 */
