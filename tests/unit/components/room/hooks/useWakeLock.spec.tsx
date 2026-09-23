import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWakeLock } from "@/components/room/hooks/useWakeLock";

/** Spec 069 FR-029: a phone stays awake at the table and while searching. */
describe("useWakeLock", () => {
  const release = vi.fn(async () => undefined);
  const request = vi.fn(async () => ({ release }));
  let coarse = true;
  let visible = true;
  beforeEach(() => {
    release.mockClear();
    request.mockClear();
    coarse = true;
    visible = true;
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse") ? coarse : false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (visible ? "visible" : "hidden") });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("holds the screen awake while active on a coarse pointer, and lets go when inactive", async () => {
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await act(async () => {});
    expect(request).toHaveBeenCalledWith("screen");
    rerender({ on: false });
    await act(async () => {});
    expect(release).toHaveBeenCalled();
  });

  it("takes it again when the tab comes back", async () => {
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    visible = false;
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    visible = true;
    await act(async () => void document.dispatchEvent(new Event("visibilitychange")));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does nothing with a fine pointer, or without the API", async () => {
    coarse = false;
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).not.toHaveBeenCalled();
    coarse = true;
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).not.toHaveBeenCalled();
  });

  it("lets go when unmounted", async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    unmount();
    await act(async () => {});
    expect(release).toHaveBeenCalled();
  });
});
