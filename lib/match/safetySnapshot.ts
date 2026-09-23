import type { MatchState } from "@/lib/types/match";

/**
 * Decides whether the background safety-net poller should apply a freshly
 * fetched snapshot (spec 050, contracts/match-state.md). The poller runs
 * alongside Realtime for the case where broadcasts fail silently, so it must
 * catch every signal a broadcast can carry: a move finished (the resolution
 * cursor moved), the match started or ended, a move went in or out of flight,
 * the disconnect flag flipped, a player sat down at the table (spec 069).
 */
export function shouldApplySafetySnapshot(current: MatchState, snapshot: MatchState): boolean {
  return (
    snapshot.resolvedSeq > current.resolvedSeq ||
    snapshot.state !== current.state ||
    (snapshot.clock.startedAt ?? null) !== (current.clock.startedAt ?? null) ||
    inFlightChanged(current, snapshot) ||
    (snapshot.disconnectedPlayerId ?? null) !== (current.disconnectedPlayerId ?? null) ||
    seatsChanged(current, snapshot)
  );
}

function inFlightChanged(current: MatchState, snapshot: MatchState): boolean {
  const key = (s: MatchState) => `${s.players.playerA.inFlight?.moveId ?? ""}|${s.players.playerB.inFlight?.moveId ?? ""}`;
  return key(current) !== key(snapshot);
}

function seatsChanged(current: MatchState, snapshot: MatchState): boolean {
  const key = (s: MatchState) => `${s.table?.seats.a ?? ""}|${s.table?.seats.b ?? ""}`;
  return key(current) !== key(snapshot);
}
