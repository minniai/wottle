import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettleHold } from "@/components/room/hooks/useSettleHold";
import { SETTLE_HOLD_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";

describe("useSettleHold (spec 048 FR-022)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoomStore.setState({ holdRound: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds the round on the settled edge and releases it after SETTLE_HOLD_MS", () => {
    const { rerender } = renderHook((p: { settled: boolean }) => useSettleHold({ round: 3, settled: p.settled, drew: true }), { initialProps: { settled: false } });
    expect(useRoomStore.getState().holdRound).toBeNull();
    rerender({ settled: true });
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS - 1));
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(1));
    expect(useRoomStore.getState().holdRound).toBeNull();
  });

  it("a settle-only plan (nothing drawn) holds nothing", () => {
    const { rerender } = renderHook((p: { settled: boolean }) => useSettleHold({ round: 3, settled: p.settled, drew: false }), { initialProps: { settled: false } });
    rerender({ settled: true });
    expect(useRoomStore.getState().holdRound).toBeNull();
  });

  it("does not hold twice for the same round, and holds the next", () => {
    const { rerender } = renderHook((p: { round: number; settled: boolean }) => useSettleHold({ round: p.round, settled: p.settled, drew: true }), { initialProps: { round: 3, settled: false } });
    rerender({ round: 3, settled: true });
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS));
    rerender({ round: 3, settled: false });
    rerender({ round: 3, settled: true });
    expect(useRoomStore.getState().holdRound).toBeNull();
    rerender({ round: 4, settled: false });
    rerender({ round: 4, settled: true });
    expect(useRoomStore.getState().holdRound).toBe(4);
  });

  it("marks the hold for the profiler", () => {
    const mark = vi.spyOn(performance, "mark");
    const { rerender } = renderHook((p: { settled: boolean }) => useSettleHold({ round: 2, settled: p.settled, drew: true }), { initialProps: { settled: false } });
    rerender({ settled: true });
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS));
    expect(mark).toHaveBeenCalledWith("room:settle-hold:start", expect.anything());
    expect(mark).toHaveBeenCalledWith("room:settle-hold:end", expect.anything());
    mark.mockRestore();
  });

  it("holds an instantaneous reduced-motion reveal for the full reading pause", () => {
    const { rerender } = renderHook((p: { drew: boolean }) => useSettleHold({ round: 3, settled: true, drew: p.drew }), { initialProps: { drew: false } });
    rerender({ drew: true });
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS));
    expect(useRoomStore.getState().holdRound).toBeNull();
  });

  it("resets the round and pending timer when the match changes", () => {
    const { rerender } = renderHook((p: { matchId: string; settled: boolean }) => useSettleHold({ ...p, round: 3, drew: true }), { initialProps: { matchId: "first", settled: false } });
    rerender({ matchId: "first", settled: true });
    act(() => vi.advanceTimersByTime(600));
    rerender({ matchId: "rematch", settled: false });
    expect(useRoomStore.getState().holdRound).toBeNull();
    rerender({ matchId: "rematch", settled: true });
    act(() => vi.advanceTimersByTime(600));
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(600));
    expect(useRoomStore.getState().holdRound).toBeNull();
  });
});
