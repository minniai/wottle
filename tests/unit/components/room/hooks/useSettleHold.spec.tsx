import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettleHold } from "@/components/room/hooks/useSettleHold";
import { SETTLE_HOLD_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";

type Props = { resolvedRound: number | null; settled: boolean };
const render = (initialProps: Props) =>
  renderHook((p: Props) => useSettleHold({ matchId: "m1", ...p }), { initialProps });

describe("useSettleHold (spec 048 FR-022)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoomStore.setState({ holdRound: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds from the moment the round resolves until the bands have settled and the pause has run", () => {
    const { rerender } = render({ resolvedRound: null, settled: true });
    expect(useRoomStore.getState().holdRound).toBeNull();
    // The round resolves; the bands are still drawing, so the hold runs on.
    rerender({ resolvedRound: 3, settled: false });
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(10_000));
    expect(useRoomStore.getState().holdRound).toBe(3);
    // They settle; the reading pause starts here, not before.
    rerender({ resolvedRound: 3, settled: true });
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS - 1));
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(1));
    expect(useRoomStore.getState().holdRound).toBeNull();
  });

  it("a round that scored nothing still closes: the hold is about the round, not the bands", () => {
    // Seen live: with no words to draw the live row went straight from
    // `played · waiting` to the next round, which is the silence spec 048 ends.
    const { rerender } = render({ resolvedRound: null, settled: true });
    rerender({ resolvedRound: 3, settled: true });
    expect(useRoomStore.getState().holdRound).toBe(3);
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS));
    expect(useRoomStore.getState().holdRound).toBeNull();
  });

  it("holds each round once, and the next one after it", () => {
    const { rerender } = render({ resolvedRound: null, settled: true });
    rerender({ resolvedRound: 3, settled: true });
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS));
    expect(useRoomStore.getState().holdRound).toBeNull();
    // A late re-render for the same round does not hold it again.
    rerender({ resolvedRound: 3, settled: true });
    expect(useRoomStore.getState().holdRound).toBeNull();
    rerender({ resolvedRound: 4, settled: true });
    expect(useRoomStore.getState().holdRound).toBe(4);
  });

  it("marks the pause for the profiler", () => {
    const mark = vi.spyOn(performance, "mark");
    const { rerender } = render({ resolvedRound: null, settled: true });
    rerender({ resolvedRound: 2, settled: true });
    act(() => vi.advanceTimersByTime(SETTLE_HOLD_MS));
    expect(mark).toHaveBeenCalledWith("room:settle-hold:start", expect.anything());
    expect(mark).toHaveBeenCalledWith("room:settle-hold:end", expect.anything());
    mark.mockRestore();
  });

  it("resets the round and the pending pause when the match changes", () => {
    const { rerender } = renderHook((p: Props & { matchId: string }) => useSettleHold(p), {
      initialProps: { matchId: "m1", resolvedRound: 3 as number | null, settled: true },
    });
    expect(useRoomStore.getState().holdRound).toBe(3);
    rerender({ matchId: "m2", resolvedRound: null, settled: true });
    expect(useRoomStore.getState().holdRound).toBeNull();
    // The same round number in the new match is a different round, and holds.
    rerender({ matchId: "m2", resolvedRound: 3, settled: false });
    expect(useRoomStore.getState().holdRound).toBe(3);
  });
});
