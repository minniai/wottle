import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewAutoplay } from "@/components/room/hooks/useReviewAutoplay";

describe("useReviewAutoplay (spec 071 FR-035, R16)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function play(step = 3, stepCount = 5) {
    const onStep = vi.fn();
    const hook = renderHook(({ s }) => useReviewAutoplay({ step: s, stepCount, onStep }), { initialProps: { s: step } });
    return { hook, onStep };
  }

  it("steps once a second while it plays", () => {
    const { hook, onStep } = play();
    act(() => hook.result.current.toggle());
    expect(hook.result.current.playing).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(onStep).toHaveBeenLastCalledWith(4);
    hook.rerender({ s: 4 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onStep).toHaveBeenLastCalledWith(5);
  });

  it("stops at the last step", () => {
    const { hook, onStep } = play(4, 5);
    act(() => hook.result.current.toggle());
    act(() => vi.advanceTimersByTime(1000));
    hook.rerender({ s: 5 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(hook.result.current.playing).toBe(false);
  });

  it("starts again from the first step when played at the last", () => {
    const { hook, onStep } = play(5, 5);
    act(() => hook.result.current.toggle());
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("stops when told, and when the tab hides", () => {
    const { hook } = play();
    act(() => hook.result.current.toggle());
    act(() => hook.result.current.stop());
    expect(hook.result.current.playing).toBe(false);
    act(() => hook.result.current.toggle());
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(hook.result.current.playing).toBe(false);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });
});
