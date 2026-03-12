import type { WordScore, RoundSummary, ScoreTotals, RoundMove } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";
import type { Language } from "@/lib/types/game-config";
import { LETTER_SCORING_VALUES_IS } from "@/docs/wordlist/letter_scoring_values_is";
import { LETTER_SCORING_VALUES_EN } from "@/docs/wordlist/letter_scoring_values_en";
import { LETTER_SCORING_VALUES_SE } from "@/docs/wordlist/letter_scoring_values_se";
import { LETTER_SCORING_VALUES_NO } from "@/docs/wordlist/letter_scoring_values_no";
import { LETTER_SCORING_VALUES_DK } from "@/docs/wordlist/letter_scoring_values_dk";

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
export function aggregateRoundSummary(
    matchId: string,
    roundNumber: number,
    wordScores: WordScore[],
    previousTotals: ScoreTotals,
    playerAId: string,
    playerBId: string,
    moves: RoundMove[] = [],
): RoundSummary {
    // Group words by the actual match player slots so scores always land in
    // the correct column — even when one player has zero words this round.
    const playerAWords = wordScores.filter((ws) => ws.playerId === playerAId);
    const playerBWords = wordScores.filter((ws) => ws.playerId === playerBId);

    // Calculate round scores (pure word point sums — no combo bonus)
    const playerAScore =
        playerAWords.reduce((sum, ws) => sum + ws.totalPoints, 0);
    const playerBScore =
        playerBWords.reduce((sum, ws) => sum + ws.totalPoints, 0);

    const deltas: ScoreTotals = {
        playerA: playerAScore,
        playerB: playerBScore,
    };

    // Calculate new totals
    const totals: ScoreTotals = {
        playerA: previousTotals.playerA + playerAScore,
        playerB: previousTotals.playerB + playerBScore,
    };

    // Extract highlights (coordinates for all words)
    const highlights: Coordinate[][] = wordScores.map((ws) => ws.coordinates);

    return {
        matchId,
        roundNumber,
        words: wordScores,
        deltas,
        totals,
        highlights,
        resolvedAt: new Date().toISOString(),
        moves,
    };
}

/**
 * Get score totals for a match by aggregating all word_score_entries.
 * This can be used to compute current totals before creating a round summary.
 */
export async function getCurrentScoreTotals(
    matchId: string,
    client: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: any[] | null; error: any }> } } }
): Promise<ScoreTotals> {
    // This is a placeholder - actual implementation would query word_score_entries
    // and aggregate by player_id
    return { playerA: 0, playerB: 0 };
}

