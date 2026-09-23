import { renderHook, act } from "@testing-library/react";
import { copyEn } from "@/lib/i18n/copy/en";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMatchOverSlip, endReasonFor, useMatchOverSlip, type MatchOverSlipInput } from "@/components/room/hooks/useMatchOverSlip";
import { MATCH_OVER_DELAY_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";
import type { MatchState, PlayerMatchFacts } from "@/lib/types/match";
import { SEATED_TABLE } from "@/lib/match/table";

const facts = (playerId: string, movesPlayed: number, score: number): PlayerMatchFacts => ({ playerId, movesPlayed, score, inFlight: null, lastResolution: null });
const match: MatchState = {
  matchId: "m1",
  board: [],
  state: "completed",
  players: { playerA: facts("you", 10, 127), playerB: facts("opp", 10, 170) },
  clock: { startedAt: "2026-01-01T00:00:00Z", deadlineAt: "2026-01-01T00:05:00Z", serverNow: "2026-01-01T00:04:52Z" },
  moveLimit: 10,
  language: "is",
  resolvedSeq: 20,
  scores: { playerA: 127, playerB: 170 },
  frozenTiles: {},
  table: SEATED_TABLE,
  stakes: null,
  endedReason: "moves_complete",
};
const input: MatchOverSlipInput = {
  match,
  viewerSlot: "player_a",
  completed: true,
  readOnly: false,
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points" },
  durationMmSs: "4:52",
  viewerName: "Birna",
  opponentName: "Kári",
  ratings: null,
  rematch: "idle",
  busy: false,
  revealed: true,
};

describe("useMatchOverSlip (spec 048 FR-003)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoomStore.setState({ slip: null, slipDismissed: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the slip winner-first with rating pending until rows arrive", () => {
    const slip = buildMatchOverSlip(input, copyEn);
    expect(slip).toMatchObject({ kind: "matchOver", scores: { you: 127, opp: 170 }, durationMmSs: "4:52" });
    expect(slip && slip.kind === "matchOver" ? slip.ratings.map((r) => [r.seat, r.line]) : null).toEqual([["opp", "rating pending"], ["you", "rating pending"]]);
  });

  it("reads the end reason off the state (spec 050 reasons)", () => {
    expect(endReasonFor(match)).toBe("moves");
    expect(endReasonFor({ ...match, endedReason: "incomplete" })).toBe("incomplete");
    expect(endReasonFor({ ...match, endedReason: "both_incomplete" })).toBe("incomplete");
    expect(endReasonFor({ ...match, endedReason: "forfeit" })).toBe("resigned");
    expect(endReasonFor({ ...match, endedReason: null, disconnectedPlayerId: "opp" })).toBe("abandoned");
    expect(endReasonFor({ ...match, endedReason: null, players: { ...match.players, playerB: facts("opp", 6, 88) } })).toBe("incomplete");
  });

  it("lands after the delay once nothing is busy; waits while busy; lands at once without a reveal", () => {
    const { rerender } = renderHook((p: MatchOverSlipInput) => useMatchOverSlip(p), { initialProps: { ...input, busy: true } });
    act(() => vi.advanceTimersByTime(MATCH_OVER_DELAY_MS * 2));
    expect(useRoomStore.getState().slip).toBeNull();
    rerender({ ...input, busy: false });
    act(() => vi.advanceTimersByTime(MATCH_OVER_DELAY_MS - 1));
    expect(useRoomStore.getState().slip).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(useRoomStore.getState().slip?.kind).toBe("matchOver");
    useRoomStore.setState({ slip: null });
    renderHook(() => useMatchOverSlip({ ...input, revealed: false }));
    act(() => vi.advanceTimersByTime(0));
    expect(useRoomStore.getState().slip?.kind).toBe("matchOver");
  });

  it("rewrites the slip in place when ratings or the rematch phase change, keeping a dismissal", () => {
    const { rerender } = renderHook((p: MatchOverSlipInput) => useMatchOverSlip(p), { initialProps: input });
    act(() => vi.advanceTimersByTime(MATCH_OVER_DELAY_MS));
    useRoomStore.getState().dismissSlip();
    rerender({ ...input, rematch: "incoming" });
    expect(useRoomStore.getState().slip).toMatchObject({ kind: "matchOver", rematch: "incoming" });
    expect(useRoomStore.getState().slipDismissed).toBe(true);
  });

  it("waits for the result delay again in a rematch", () => {
    const { rerender } = renderHook((p: MatchOverSlipInput) => useMatchOverSlip(p), { initialProps: input });
    act(() => vi.advanceTimersByTime(MATCH_OVER_DELAY_MS));
    expect(useRoomStore.getState().slip?.kind).toBe("matchOver");
    useRoomStore.setState({ slip: null });
    rerender({ ...input, match: { ...match, matchId: "m2" } });
    act(() => vi.advanceTimersByTime(MATCH_OVER_DELAY_MS - 1));
    expect(useRoomStore.getState().slip).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(useRoomStore.getState().slip?.kind).toBe("matchOver");
  });
});
