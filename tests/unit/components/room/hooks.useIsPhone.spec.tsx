import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsPhone } from "@/components/room/hooks/useIsPhone";

type Listener = () => void;

/** A matchMedia stub that can flip, as a rotation or a resize does. */
function stubMatchMedia(matches: boolean) {
  const listeners: Listener[] = [];
  const query = {
    get matches() {
      return query._matches;
    },
    _matches: matches,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    query,
    flip(next: boolean) {
      query._matches = next;
      for (const fn of [...listeners]) fn();
    },
    listenerCount: () => listeners.length,
  };
}

describe("useIsPhone (spec 045 US4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when matchMedia is absent, as on the server", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useIsPhone());
    // The desktop ledger is the safe first paint; a phone corrects it on hydration.
    expect(result.current).toBe(false);
  });

  it("follows the 900px query", () => {
    stubMatchMedia(true);
    expect(renderHook(() => useIsPhone()).result.current).toBe(true);

    vi.unstubAllGlobals();
    stubMatchMedia(false);
    expect(renderHook(() => useIsPhone()).result.current).toBe(false);
  });

  it("updates when the query changes, as a rotation does", () => {
    const media = stubMatchMedia(false);
    const { result, rerender } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);

    media.flip(true);
    rerender();
    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useIsPhone());
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
