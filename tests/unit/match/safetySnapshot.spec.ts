import { describe, expect, it } from "vitest";

import { shouldApplySafetySnapshot } from "@/lib/match/safetySnapshot";
import type { MatchState, PlayerMatchFacts } from "@/lib/types/match";

/** Spec 050 contracts/match-state.md § safety poll. */
const facts = (playerId: string, over: Partial<PlayerMatchFacts> = {}): PlayerMatchFacts => ({ playerId, movesPlayed: 3, score: 10, inFlight: null, lastResolution: null, ...over });

function buildState(overrides: Partial<MatchState> = {}, a: Partial<PlayerMatchFacts> = {}, b: Partial<PlayerMatchFacts> = {}): MatchState {
  return {
    matchId: "match-1",
    board: [["a"]],
    state: "in_progress",
    players: { playerA: facts("player-a", a), playerB: facts("player-b", b) },
    clock: { startedAt: "2026-09-21T10:00:00.000Z", deadlineAt: "2026-09-21T10:05:00.000Z", serverNow: "2026-09-21T10:01:00.000Z" },
    moveLimit: 10,
    resolvedSeq: 6,
    scores: { playerA: 10, playerB: 10 },
    frozenTiles: {},
    disconnectedPlayerId: null,
    ...overrides,
  };
}

describe("shouldApplySafetySnapshot", () => {
  it("ignores identical snapshots and a fresher serverNow alone", () => {
    expect(shouldApplySafetySnapshot(buildState(), buildState())).toBe(false);
    expect(shouldApplySafetySnapshot(buildState(), buildState({ clock: { ...buildState().clock, serverNow: "2026-09-21T10:01:02.000Z" } }))).toBe(false);
  });

  it("applies when the resolution cursor moved, never when it lags", () => {
    expect(shouldApplySafetySnapshot(buildState(), buildState({ resolvedSeq: 7 }))).toBe(true);
    expect(shouldApplySafetySnapshot(buildState(), buildState({ resolvedSeq: 5 }))).toBe(false);
  });

  it("applies when the match started or ended", () => {
    expect(shouldApplySafetySnapshot(buildState(), buildState({ state: "completed" }))).toBe(true);
    const pending = buildState({ state: "pending", clock: { startedAt: null, deadlineAt: null, serverNow: "2026-09-21T10:00:00.000Z" } });
    expect(shouldApplySafetySnapshot(pending, buildState())).toBe(true);
  });

  it("applies when a move went in or out of flight for either player", () => {
    const inFlight = { moveId: "m-7", globalSeq: 7, receivedAt: "2026-09-21T10:01:00.000Z" };
    expect(shouldApplySafetySnapshot(buildState(), buildState({}, {}, { inFlight }))).toBe(true);
    expect(shouldApplySafetySnapshot(buildState({}, { inFlight }), buildState())).toBe(true);
  });

  it("applies when the disconnect flag flips either way", () => {
    expect(shouldApplySafetySnapshot(buildState(), buildState({ disconnectedPlayerId: "player-b" }))).toBe(true);
    expect(shouldApplySafetySnapshot(buildState({ disconnectedPlayerId: "player-b" }), buildState())).toBe(true);
  });
});
