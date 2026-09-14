import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";

import { useClockTick } from "@/components/room/hooks/useClockTick";
import { computeFieldSize, useFieldSize } from "@/components/room/hooks/useFieldSize";
import { useReducedMotion } from "@/components/room/hooks/useReducedMotion";
import type { MatchState } from "@/lib/types/match";

describe("computeFieldSize (design system §4)", () => {
  it("is the largest square under two 60px bars + gaps + padding, capped at 720", () => {
    expect(computeFieldSize(1200, 1000)).toBe(720);
    expect(computeFieldSize(1200, 900)).toBe(900 - 120 - 24 - 48);
    expect(computeFieldSize(1200, 800)).toBe(800 - 120 - 24 - 48);
    expect(computeFieldSize(390, 844)).toBe(390);
    expect(computeFieldSize(390, 100)).toBe(0);
  });
});

describe("useFieldSize", () => {
  class RO {
    static instances: RO[] = [];
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
      RO.instances.push(this);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  beforeEach(() => {
    RO.instances = [];
    vi.stubGlobal("ResizeObserver", RO);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("measures the room element and re-measures on resize", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 1400, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 700, configurable: true });
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      return useFieldSize(ref);
    });
    expect(result.current).toBe(700 - 120 - 24 - 48);
    Object.defineProperty(el, "clientHeight", { value: 1000, configurable: true });
    act(() => RO.instances[0].cb([], RO.instances[0] as unknown as ResizeObserver));
    expect(result.current).toBe(720);
  });
});

describe("useReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("reflects prefers-reduced-motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});

describe("useClockTick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const timers: MatchState["timers"] = {
    playerA: { playerId: "a", remainingMs: 300_000, status: "running" },
    playerB: { playerId: "b", remainingMs: 240_000, status: "paused" },
  };

  it("drains only running clocks, one second at a time, never below zero", () => {
    const { result } = renderHook(() => useClockTick(timers));
    expect(result.current).toEqual({ playerA: 300_000, playerB: 240_000 });
    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.playerA).toBe(297_000);
    expect(result.current.playerB).toBe(240_000);
  });

  it("re-anchors when a new snapshot arrives", () => {
    const { result, rerender } = renderHook(({ t }) => useClockTick(t), { initialProps: { t: timers } });
    act(() => vi.advanceTimersByTime(5_000));
    rerender({ t: { ...timers, playerA: { ...timers.playerA, remainingMs: 100_000 } } });
    expect(result.current.playerA).toBe(100_000);
  });
});
