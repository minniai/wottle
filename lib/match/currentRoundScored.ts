import { deriveHighlightPlayerColors } from "@/components/match/deriveHighlightPlayerColors";
import type { PartialRoundSummary, RoundSummary } from "@/lib/types/match";

/**
 * Builders for the "current-round scored" tile map (spec 043).
 *
 * The map keys are canonical `"x,y"` strings and values are the scoring
 * player's CSS highlight color, mirroring `deriveHighlightPlayerColors`. The
 * map is the source of the persistent "scored THIS round" mark that
 * `MatchClient` holds until the round advances — visually distinct from the
 * calm frozen tint used for tiles scored in previous rounds.
 *
 * Two sources feed the same map so the first mover's words (revealed mid-round
 * via the spec-042 fast path) and the full round summary describe the same
 * tiles with the same color — `MatchClient` merges them dedupe-guarded so a
 * tile is never re-flashed or recolored when both arrive (FR-011).
 */

/** Project a full round summary's scored words to the current-round color map. */
export function buildCurrentRoundScoredFromSummary(
  summary: RoundSummary,
  playerAId: string,
): Record<string, string> {
  return deriveHighlightPlayerColors(summary.words, playerAId);
}

/** Project a first-mover partial summary's scored words to the current-round color map. */
export function buildCurrentRoundScoredFromPartial(
  partial: PartialRoundSummary,
  playerAId: string,
): Record<string, string> {
  return deriveHighlightPlayerColors(partial.words, playerAId);
}
