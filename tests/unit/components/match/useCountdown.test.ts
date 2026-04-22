import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useCountdown } from "@/components/match/useCountdown";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCountdown", () => {
  test("starts at the initial seconds", () => {
    const { result } = renderHook(() => useCountdown(90));
    expect(result.current.remaining).toBe(90);
    expect(result.current.expired).toBe(false);
  });

  test("decrements every second", () => {
    const { result } = renderHook(() => useCountdown(5));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.remaining).toBe(3);
  });

  test("flips `expired` to true when remaining reaches 0", () => {
    const { result } = renderHook(() => useCountdown(2));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.remaining).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  test("resets when startSeconds changes", () => {
    const { result, rerender } = renderHook(({ s }) => useCountdown(s), {
      initialProps: { s: 10 },
    });
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.remaining).toBe(7);
    rerender({ s: 90 });
    expect(result.current.remaining).toBe(90);
  });
});
