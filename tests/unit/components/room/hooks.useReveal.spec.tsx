import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "@/components/room/hooks/useCountUp";
import { useReveal } from "@/components/room/hooks/useReveal";

describe("useReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances band → write → countUp → settle on the plan's timeline and ticks per band", () => {
    const onBand = vi.fn();
    const { result } = renderHook(() => useReveal({ key: "r3", wordIds: ["a", "b"], alreadyDrawn: new Set(), reducedMotion: false, onBand }));
    expect(result.current).toEqual({ bandsDrawn: 0, wordsWritten: 0, totalsShown: false, settled: false, planIds: ["a", "b"] });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.bandsDrawn).toBe(1);
    expect(onBand).toHaveBeenCalledWith(0);
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.wordsWritten).toBe(1);
    act(() => vi.advanceTimersByTime(520));
    expect(result.current).toMatchObject({ bandsDrawn: 2, wordsWritten: 2, totalsShown: true, settled: false });
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.settled).toBe(true);
    expect(onBand).toHaveBeenCalledTimes(2);
  });

  it("no key → done; reduced motion → settles immediately; re-keying restarts", () => {
    const { result, rerender } = renderHook((p: { key: string | null; rm: boolean }) => useReveal({ key: p.key, wordIds: ["a"], alreadyDrawn: new Set(), reducedMotion: p.rm }), { initialProps: { key: null as string | null, rm: false } });
    expect(result.current.settled).toBe(true);
    rerender({ key: "r1", rm: true });
    expect(result.current.settled).toBe(true); // settle-only plans complete synchronously
    rerender({ key: "r2", rm: false });
    expect(result.current.settled).toBe(false);
  });
});

describe("useCountUp", () => {
  it("shows the target immediately under reduced motion", () => {
    const { result, rerender } = renderHook((p: { t: number }) => useCountUp(p.t, true), { initialProps: { t: 10 } });
    rerender({ t: 42 });
    expect(result.current).toBe(42);
  });
});
