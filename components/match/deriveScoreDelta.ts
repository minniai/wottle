import type { ScoreDelta } from "@/components/match/ScoreDeltaPopup";
import type { RoundSummary } from "@/lib/types/match";

/**
 * Derives the score delta popup data for a specific player from a round summary.
 * Returns null when the player earned zero points (no popup should show).
 */
export function deriveScoreDelta(
  summary: RoundSummary,
  playerId: string,
  slot: "player_a" | "player_b",
): ScoreDelta | null {
  const playerWords = summary.words.filter(
    (w) => w.playerId === playerId && !w.isDuplicate,
  );
  const letterPoints = playerWords.reduce((sum, w) => sum + w.lettersPoints, 0);
  const lengthBonus = playerWords.reduce((sum, w) => sum + w.bonusPoints, 0);
  const combo =
    slot === "player_a"
      ? (summary.comboBonus?.playerA ?? 0)
      : (summary.comboBonus?.playerB ?? 0);
  if (letterPoints === 0 && lengthBonus === 0 && combo === 0) return null;
  return { letterPoints, lengthBonus, combo };
}
