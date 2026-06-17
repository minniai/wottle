import type { Coordinate } from "@/lib/types/board";
import type { PartialRoundSummary, PendingMove } from "@/lib/types/match";

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

export interface FirstMoverReveal {
  from: Coordinate;
  to: Coordinate;
  key: string;
}

/**
 * The opponent's board is `board_snapshot_before` (pre-swap) mid-round, so when
 * the instant-scoring partial reveal highlights the first mover's scored word,
 * the swapped-in letters still show their old values (O-58 / O-68). This returns
 * the first mover's swap so the caller can apply it (via `externalSwap`) on the
 * opponent's board — making the revealed letters match the scored word.
 *
 * Returns null for the first mover themselves: their board already carries the
 * optimistic swap from their own submission, so re-applying it would double-swap.
 */
export function deriveFirstMoverReveal(
  partial: PartialRoundSummary,
  pendingMoves: PendingMove[] | undefined,
  currentPlayerId: string,
): FirstMoverReveal | null {
  if (currentPlayerId === partial.firstMoverId) return null;
  const move = pendingMoves?.find((m) => m.playerId === partial.firstMoverId);
  if (!move) return null;
  return { from: move.from, to: move.to, key: buildPartialRevealKey(partial) };
}
