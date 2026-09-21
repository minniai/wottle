import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMoveHold } from "@/components/room/hooks/useMoveHold";
import { MOVE_HOLD_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";

type Props = { resolved: { moveId: string; seq: number } | null; settled: boolean };
const render = (initialProps: Props) =>
  renderHook((p: Props) => useMoveHold({ matchId: "m1", ...p }), { initialProps });

describe("useMoveHold (spec 050 FR-013)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoomStore.setState({ holdMove: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds from the moment your move resolves until its bands have settled and the pause has run", () => {
    const { rerender } = render({ resolved: null, settled: true });
    expect(useRoomStore.getState().holdMove).toBeNull();
    rerender({ resolved: { moveId: "mv-4", seq: 4 }, settled: false });
    expect(useRoomStore.getState().holdMove).toBe(4);
    act(() => vi.advanceTimersByTime(10_000));
    expect(useRoomStore.getState().holdMove).toBe(4);
    rerender({ resolved: { moveId: "mv-4", seq: 4 }, settled: true });
    act(() => vi.advanceTimersByTime(MOVE_HOLD_MS - 1));
    expect(useRoomStore.getState().holdMove).toBe(4);
    act(() => vi.advanceTimersByTime(1));
    expect(useRoomStore.getState().holdMove).toBeNull();
  });

  it("a move that scored nothing still holds: the pause is about the move closing", () => {
    const { rerender } = render({ resolved: null, settled: true });
    rerender({ resolved: { moveId: "mv-5", seq: 5 }, settled: true });
    expect(useRoomStore.getState().holdMove).toBe(5);
    act(() => vi.advanceTimersByTime(MOVE_HOLD_MS));
    expect(useRoomStore.getState().holdMove).toBeNull();
  });

  it("the same move never holds twice; a new move holds anew", () => {
    const { rerender } = render({ resolved: { moveId: "mv-1", seq: 1 }, settled: true });
    act(() => vi.advanceTimersByTime(MOVE_HOLD_MS));
    expect(useRoomStore.getState().holdMove).toBeNull();
    rerender({ resolved: { moveId: "mv-1", seq: 1 }, settled: false });
    expect(useRoomStore.getState().holdMove).toBeNull();
    rerender({ resolved: { moveId: "mv-2", seq: 2 }, settled: false });
    expect(useRoomStore.getState().holdMove).toBe(2);
  });

  it("a settle that flips back to drawing cancels the armed pause", () => {
    const { rerender } = render({ resolved: { moveId: "mv-3", seq: 3 }, settled: true });
    act(() => vi.advanceTimersByTime(MOVE_HOLD_MS - 100));
    rerender({ resolved: { moveId: "mv-3", seq: 3 }, settled: false });
    act(() => vi.advanceTimersByTime(1_000));
    expect(useRoomStore.getState().holdMove).toBe(3);
    rerender({ resolved: { moveId: "mv-3", seq: 3 }, settled: true });
    act(() => vi.advanceTimersByTime(MOVE_HOLD_MS));
    expect(useRoomStore.getState().holdMove).toBeNull();
  });

  it("a new match ends any hold", () => {
    const { rerender } = renderHook((p: Props & { matchId: string }) => useMoveHold(p), { initialProps: { matchId: "m1", resolved: { moveId: "mv-1", seq: 1 } as Props["resolved"], settled: false } });
    expect(useRoomStore.getState().holdMove).toBe(1);
    rerender({ matchId: "m2", resolved: null, settled: true });
    expect(useRoomStore.getState().holdMove).toBeNull();
  });
});
