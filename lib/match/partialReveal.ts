import type { Coordinate } from "@/lib/types/board";
import type { PartialRoundSummary } from "@/lib/types/match";

/**
 * Dedupe + projection helpers for the instant-scoring partial reveal
 * (spec 042 / Linear O-57).
 *
 * Extracted from `MatchClient` so the dedupe key + highlight derivation can
 * be unit-tested in isolation. `MatchClient` keeps a `useRef<Set<string>>`
 * of seen keys and only runs the reveal pipeline when a `partialSummary`'s
 * key is unseen.
 *
 * The dedupe key is `${firstMoverId}-${firstSubmissionAt}` — the same shape
 * as `animatedOpponentMoveKeysRef` (PR #210) so the two dedupe sets can
 * cross-reference: once a partial reveal animates, the eventual
 * `lastSummary` event for the same round MUST NOT re-animate the first
 * mover's swap.
 */

export function buildPartialRevealKey(partial: PartialRoundSummary): string {
  return `${partial.firstMoverId}-${partial.firstSubmissionAt}`;
}

export function deriveRevealHighlightsFromPartial(
  partial: PartialRoundSummary,
): Coordinate[][] {
  return partial.words.map((w) => w.coordinates);
}

export function isFirstMoverPlayerA(
  partial: PartialRoundSummary,
  playerAId: string,
): boolean {
  return partial.firstMoverId === playerAId;
}
