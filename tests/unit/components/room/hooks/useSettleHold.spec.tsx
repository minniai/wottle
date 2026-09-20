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
});
