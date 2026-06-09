import { buildPartialRevealKey } from "./partialReveal";
import type { MatchState } from "@/lib/types/match";

/**
 * Decides whether the background safety-net poller should apply a freshly
 * fetched snapshot. The poller runs alongside Realtime and exists for the
 * case where server-side broadcasts fail silently (e.g. local act/Docker,
 * CI runners) — so it must catch every signal a broadcast can carry that
 * the client cannot recover from otherwise:
 *
 * - the round advanced or the match completed,
 * - the disconnect flag flipped,
 * - the instant-scoring fast path (spec 042) froze tiles or published a
 *   partial summary mid-`collecting`. Without applying these, the second
 *   player's board keeps offering tiles the server already froze and their
 *   swaps are rejected with no visible cause.
 */
export function shouldApplySafetySnapshot(
  current: MatchState,
  snapshot: MatchState,
): boolean {
  const roundAdvanced = snapshot.currentRound > current.currentRound;
  const matchCompleted =
    snapshot.state === "completed" && current.state !== "completed";
  const disconnectChanged =
    (snapshot.disconnectedPlayerId ?? null) !==
    (current.disconnectedPlayerId ?? null);

  return (
    roundAdvanced ||
    matchCompleted ||
    disconnectChanged ||
    frozenTilesChanged(current, snapshot) ||
    partialSummaryChanged(current, snapshot)
  );
}

/**
 * Freeze entries are append-only within a match, so comparing key sets is
 * sufficient (values never mutate once written).
 */
function frozenTilesChanged(current: MatchState, snapshot: MatchState): boolean {
  const currentKeys = Object.keys(current.frozenTiles ?? {});
  const snapshotKeys = Object.keys(snapshot.frozenTiles ?? {});
  if (currentKeys.length !== snapshotKeys.length) return true;
  const currentSet = new Set(currentKeys);
  return snapshotKeys.some((key) => !currentSet.has(key));
}

function partialSummaryChanged(
  current: MatchState,
  snapshot: MatchState,
): boolean {
  const currentKey = current.partialSummary
    ? buildPartialRevealKey(current.partialSummary)
    : null;
  const snapshotKey = snapshot.partialSummary
    ? buildPartialRevealKey(snapshot.partialSummary)
    : null;
  return currentKey !== snapshotKey;
}
