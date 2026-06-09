import { describe, expect, it } from "vitest";

import { shouldApplySafetySnapshot } from "@/lib/match/safetySnapshot";
import type { MatchState, PartialRoundSummary } from "@/lib/types/match";

function buildState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: "match-1",
    board: [["a"]],
    currentRound: 3,
    state: "collecting",
    scores: { playerA: 0, playerB: 0 },
    timers: {
      playerA: { playerId: "player-a", remainingMs: 60_000, status: "running" },
      playerB: { playerId: "player-b", remainingMs: 60_000, status: "running" },
    },
    disconnectedPlayerId: null,
    frozenTiles: {},
    partialSummary: null,
    ...overrides,
  } as MatchState;
}

function buildPartialSummary(): PartialRoundSummary {
  return {
    matchId: "match-1",
    roundNumber: 3,
    firstMoverId: "player-a",
    firstSubmissionAt: "2026-06-09T21:00:00.000Z",
    words: [
      {
        playerId: "player-a",
        word: "orð",
        totalPoints: 9,
        lettersPoints: 6,
        bonusPoints: 3,
        coordinates: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      },
    ],
    frozenTiles: { "0,0": { owner: "player_a" as const } },
  } as unknown as PartialRoundSummary;
}

describe("shouldApplySafetySnapshot", () => {
  it("ignores identical snapshots", () => {
    expect(shouldApplySafetySnapshot(buildState(), buildState())).toBe(false);
  });

  it("applies when the round advanced", () => {
    const snapshot = buildState({ currentRound: 4 });
    expect(shouldApplySafetySnapshot(buildState(), snapshot)).toBe(true);
  });

  it("applies when the match completed", () => {
    const snapshot = buildState({ state: "completed" });
    expect(shouldApplySafetySnapshot(buildState(), snapshot)).toBe(true);
  });

  it("applies when disconnect state flips", () => {
    const snapshot = buildState({ disconnectedPlayerId: "player-b" });
    expect(shouldApplySafetySnapshot(buildState(), snapshot)).toBe(true);
  });

  // Spec 042 regression: the instant-scoring fast path freezes tiles while
  // the round is still `collecting`. When the Realtime broadcast is lost,
  // the safety poller is the only delivery path — skipping the snapshot
  // leaves the second player clicking tiles the server already froze.
  it("applies when tiles froze mid-round", () => {
    const snapshot = buildState({
      frozenTiles: { "0,0": { owner: "player_a" as const } },
    });
    expect(shouldApplySafetySnapshot(buildState(), snapshot)).toBe(true);
  });

  it("applies when a partial summary appeared mid-round", () => {
    const snapshot = buildState({ partialSummary: buildPartialSummary() });
    expect(shouldApplySafetySnapshot(buildState(), snapshot)).toBe(true);
  });

  it("ignores a partial summary the client already has", () => {
    const partial = buildPartialSummary();
    const current = buildState({
      partialSummary: partial,
      frozenTiles: { "0,0": { owner: "player_a" as const } },
    });
    const snapshot = buildState({
      partialSummary: partial,
      frozenTiles: { "0,0": { owner: "player_a" as const } },
    });
    expect(shouldApplySafetySnapshot(current, snapshot)).toBe(false);
  });

  it("treats missing frozenTiles maps as empty", () => {
    const current = buildState({ frozenTiles: undefined });
    const snapshot = buildState({ frozenTiles: {} });
    expect(shouldApplySafetySnapshot(current, snapshot)).toBe(false);
  });
});
