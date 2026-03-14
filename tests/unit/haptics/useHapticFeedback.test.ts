import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useHapticFeedback", () => {
  const mockVibrate = vi.fn().mockReturnValue(true);

  beforeEach(() => {
    vi.stubGlobal("navigator", { vibrate: mockVibrate });
    mockVibrate.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Lazy import after stubbing globals
  async function importHook() {
    const mod = await import("@/lib/haptics/useHapticFeedback");
    return mod.useHapticFeedback;
  }

  it("returns 4 named vibrate functions", async () => {
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(true));
    expect(typeof result.current.vibrateValidSwap).toBe("function");
    expect(typeof result.current.vibrateInvalidMove).toBe("function");
    expect(typeof result.current.vibrateMatchStart).toBe("function");
    expect(typeof result.current.vibrateMatchEnd).toBe("function");
  });

  it("when enabled=true, vibrateValidSwap calls navigator.vibrate with [15]", async () => {
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(true));
    act(() => result.current.vibrateValidSwap());
    expect(mockVibrate).toHaveBeenCalledWith([15]);
  });

  it("when enabled=true, vibrateInvalidMove calls navigator.vibrate with [30, 50, 30]", async () => {
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(true));
    act(() => result.current.vibrateInvalidMove());
    expect(mockVibrate).toHaveBeenCalledWith([30, 50, 30]);
  });

  it("when enabled=true, vibrateMatchStart calls navigator.vibrate with [100]", async () => {
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(true));
    act(() => result.current.vibrateMatchStart());
    expect(mockVibrate).toHaveBeenCalledWith([100]);
  });

  it("when enabled=true, vibrateMatchEnd calls navigator.vibrate with [50, 30, 50]", async () => {
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(true));
    act(() => result.current.vibrateMatchEnd());
    expect(mockVibrate).toHaveBeenCalledWith([50, 30, 50]);
  });

  it("when enabled=false, navigator.vibrate is never called", async () => {
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(false));
    act(() => result.current.vibrateValidSwap());
    act(() => result.current.vibrateInvalidMove());
    act(() => result.current.vibrateMatchStart());
    act(() => result.current.vibrateMatchEnd());
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it("when navigator.vibrate is undefined, no error is thrown", async () => {
    vi.stubGlobal("navigator", {});
    const useHapticFeedback = await importHook();
    const { result } = renderHook(() => useHapticFeedback(true));
    expect(() => act(() => result.current.vibrateValidSwap())).not.toThrow();
    expect(() => act(() => result.current.vibrateMatchStart())).not.toThrow();
  });
});
