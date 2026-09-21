import type { BoardWord } from "@/lib/types/board";
import type { FrozenTileMap, WordScoreBreakdown } from "@/lib/types/match";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

import { calculateLengthBonus, calculateLetterPoints } from "./scorer";

/**
 * Score a list of BoardWords for a player using the PRD formula.
 *
 * For each word:
 *   lettersPoints = sum(letter_values) — excluding opponent-frozen tiles
 *   lengthBonus = (word_length - 2) * 5
 *   total = lettersPoints + lengthBonus
 */
export function scoreBoardWords(
  words: BoardWord[],
  playerId: string,
  frozenTiles: FrozenTileMap,
  playerSlot: "player_a" | "player_b",
  letterValues: Record<string, number> = LETTER_SCORING_VALUES_IS,
): WordScoreBreakdown[] {
  const opponentSlot =
    playerSlot === "player_a" ? "player_b" : "player_a";

  return words.map((word) => {
    const ownLetters = word.tiles
      .map((t, i) => {
        const key = `${t.x},${t.y}`;
        const frozen = frozenTiles[key];
        return frozen?.owner === opponentSlot ? "" : word.text[i];
      })
      .join("");
    const lettersPoints = calculateLetterPoints(ownLetters, letterValues);
    const lengthBonus = calculateLengthBonus(word.length);
    const totalPoints = lettersPoints + lengthBonus;

    return {
      word: word.text,
      length: word.length,
      lettersPoints,
      lengthBonus,
      totalPoints,
      tiles: word.tiles,
      playerId,
    };
  });
}
