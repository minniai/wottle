import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMatchOverSlip, endReasonFor, useMatchOverSlip, type MatchOverSlipInput } from "@/components/room/hooks/useMatchOverSlip";
import { MATCH_OVER_DELAY_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";
import type { MatchState } from "@/lib/types/match";

const match: MatchState = {
  matchId: "m1",
  board: [],
  currentRound: 10,
  state: "completed",
  timers: { playerA: { playerId: "you", remainingMs: 41_000, status: "paused" }, playerB: { playerId: "opp", remainingMs: 12_000, status: "paused" } },
  scores: { playerA: 127, playerB: 170 },
};
const input: MatchOverSlipInput = {
  match,
  viewerSlot: "player_a",
  completed: true,
  readOnly: false,
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points" },
  durationMmSs: "18:50",
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
    const slip = buildMatchOverSlip(input);
    expect(slip).toMatchObject({ kind: "matchOver", scores: { you: 127, opp: 170 }, rounds: 10 });
    expect(slip && slip.kind === "matchOver" ? slip.ratings.map((r) => [r.seat, r.line]) : null).toEqual([["opp", "rating pending"], ["you", "rating pending"]]);
  });

  it("reads the end reason off the state", () => {
    expect(endReasonFor(match)).toBe("rounds");
    expect(endReasonFor({ ...match, currentRound: 6 })).toBe("resigned");
    expect(endReasonFor({ ...match, timers: { ...match.timers, playerA: { ...match.timers.playerA, remainingMs: 0 } } })).toBe("timeout");
    expect(endReasonFor({ ...match, disconnectedPlayerId: "opp" })).toBe("abandoned");
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
    act(() => useRoomStore.getState().hydrateMatch({ ...match, matchId: "m2", state: "collecting" }, "you"));
    rerender({ ...input, match: { ...match, matchId: "m2" }, completed: false });
    rerender({ ...input, match: { ...match, matchId: "m2" }, completed: true });
    expect(useRoomStore.getState().slip).toBeNull();
    act(() => vi.advanceTimersByTime(MATCH_OVER_DELAY_MS));
    expect(useRoomStore.getState().slip?.kind).toBe("matchOver");
  });
});

describe("the end reason comes off the match, not a guess (spec 048)", () => {
  it("reads the server's recorded reason", () => {
    expect(endReasonFor({ ...match, endedReason: "disconnect" })).toBe("abandoned");
    expect(endReasonFor({ ...match, endedReason: "forfeit" })).toBe("resigned");
    expect(endReasonFor({ ...match, endedReason: "timeout" })).toBe("timeout");
    expect(endReasonFor({ ...match, endedReason: "round_limit" })).toBe("rounds");
  });

  it("a completed match whose disconnect flag has cleared is still abandoned, not resigned", () => {
    // The live bug: the server finalises on the reconnect timeout, clears the
    // flag, and the slip read `· resigned` for a player who never resigned.
    expect(endReasonFor({ ...match, currentRound: 1, endedReason: "disconnect", disconnectedPlayerId: null })).toBe("abandoned");
  });
});
