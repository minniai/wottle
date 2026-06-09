import { describe, expect, it } from "vitest";

import type { MatchState, PartialRoundSummary } from "@/lib/types/match";

const BASE_STATE: MatchState = {
  matchId: "match-1",
  board: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
  currentRound: 1,
  state: "collecting",
  timers: {
    playerA: { playerId: "a", remainingMs: 300_000, status: "running" },
    playerB: { playerId: "b", remainingMs: 300_000, status: "running" },
  },
  scores: { playerA: 0, playerB: 0 },
};

describe("MatchState.partialSummary (T004)", () => {
  it("type-checks when partialSummary is omitted", () => {
    const state: MatchState = { ...BASE_STATE };
    expect(state.partialSummary).toBeUndefined();
  });

  it("type-checks when partialSummary is null (cleared by loader)", () => {
    const state: MatchState = { ...BASE_STATE, partialSummary: null };
    expect(state.partialSummary).toBeNull();
  });

  it("type-checks when partialSummary is a populated PartialRoundSummary", () => {
    const partial: PartialRoundSummary = {
      matchId: "match-1",
      roundNumber: 1,
      firstMoverId: "a",
      firstSubmissionAt: "2026-06-09T12:00:00.000Z",
      words: [],
      delta: { playerA: 0, playerB: 0 },
      frozenTiles: {},
    };
    const state: MatchState = { ...BASE_STATE, partialSummary: partial };
    expect(state.partialSummary?.firstMoverId).toBe("a");
  });
});
