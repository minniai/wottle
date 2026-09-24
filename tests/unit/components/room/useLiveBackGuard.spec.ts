import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveBackGuard } from "@/components/room/hooks/useLiveBackGuard";

/** Spec 070 US8 (T102): Back in a live match opens the leave slip; it never resigns. */
describe("useLiveBackGuard", () => {
  let pushState: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    window.history.replaceState(null, "");
    pushState = vi.spyOn(window.history, "pushState") as unknown as typeof pushState;
  });
  afterEach(() => {
    pushState.mockRestore();
  });
  const pick = () => act(() => void window.dispatchEvent(new Event("pointerdown")));
  const back = () => act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state: null })));

  it("pushes no guard before the first pick; the first pick pushes one", () => {
    renderHook(() => useLiveBackGuard({ live: true, onBack: vi.fn() }));
    expect(pushState).not.toHaveBeenCalled();
    pick();
    expect(pushState).toHaveBeenCalledWith({ kind: "guard" }, "");
    pick();
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("raises the leave slip on Back and puts the guard back", () => {
    const onBack = vi.fn();
    renderHook(() => useLiveBackGuard({ live: true, onBack }));
    pick();
    back();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it("returning to a live match replaces its guard instead of stacking another", () => {
    window.history.replaceState({ kind: "guard" }, "");
    renderHook(() => useLiveBackGuard({ live: true, onBack: vi.fn() }));
    pick();
    expect(pushState).not.toHaveBeenCalled();
    window.history.replaceState(null, "");
  });

  it("arms beforeunload only while the match is live, and does nothing once it completes", () => {
    const onBack = vi.fn();
    const { rerender } = renderHook(({ live }) => useLiveBackGuard({ live, onBack }), { initialProps: { live: true } });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    rerender({ live: false });
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    back();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("lets go when told to leave: Back is not caught on the way out", () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useLiveBackGuard({ live: true, onBack }));
    pick();
    act(() => result.current.release());
    back();
    expect(onBack).not.toHaveBeenCalled();
  });
});
