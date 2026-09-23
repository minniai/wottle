import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAttention } from "@/components/room/hooks/useAttention";

/** Spec 069 R5: the tab knows whether it is seen and when it was last used. */
describe("useAttention", () => {
  let hidden = false;
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    hidden = false;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts input age from the last press or key", () => {
    const { result } = renderHook(() => useAttention());
    act(() => void vi.advanceTimersByTime(40_000));
    expect(result.current().inputAgoMs).toBe(40_000);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current().inputAgoMs).toBe(2_000);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(result.current().inputAgoMs).toBe(0);
  });

  it("reads the tab's visibility as it is now", () => {
    const { result } = renderHook(() => useAttention());
    expect(result.current().visible).toBe(true);
    hidden = true;
    expect(result.current().visible).toBe(false);
  });

  it("stops listening when unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useAttention());
    unmount();
    expect(remove).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
