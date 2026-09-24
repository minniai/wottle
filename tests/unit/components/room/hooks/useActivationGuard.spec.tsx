import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useActivationGuard } from "@/components/room/hooks/useActivationGuard";

describe("useActivationGuard (game flow §5.0 guards, spec 071 FR-002)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores activation for 500ms after the control appears", () => {
    const { result } = renderHook(() => useActivationGuard("rematch:rematch ▸"));
    expect(result.current()).toBe(false);
    act(() => vi.advanceTimersByTime(499));
    expect(result.current()).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current()).toBe(true);
  });

  it("starts again when the control changes meaning", () => {
    const { result, rerender } = renderHook(({ key }) => useActivationGuard(key), { initialProps: { key: "rematch:rematch ▸" } });
    act(() => vi.advanceTimersByTime(600));
    expect(result.current()).toBe(true);
    rerender({ key: "accept:accept ▸" });
    expect(result.current()).toBe(false);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current()).toBe(true);
  });
});
