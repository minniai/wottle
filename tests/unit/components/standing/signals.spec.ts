import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFavicon } from "@/components/standing/hooks/useFavicon";
import { useNotifications } from "@/components/standing/hooks/useNotifications";
import { useTabTitle } from "@/components/standing/hooks/useTabTitle";

/** Spec 070 T080: the favicon, the tab title and notifications. */
describe("useFavicon", () => {
  it("swaps the cell's letter to the opponent's colour while a call waits, and back", () => {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = "/brand/cell-is.svg";
    document.head.appendChild(link);
    const { rerender } = renderHook(({ calling }) => useFavicon("is", calling), { initialProps: { calling: true } });
    expect(link.getAttribute("href")).toBe("/brand/cell-is-call.svg");
    rerender({ calling: false });
    expect(link.getAttribute("href")).toBe("/brand/cell-is.svg");
    link.remove();
  });
});

describe("useTabTitle", () => {
  it("writes the beat and puts the page's own title back", () => {
    document.title = "lobby · Wottle";
    const { rerender } = renderHook(({ t }) => useTabTitle(t), { initialProps: { t: "(1) Kári challenges you · Wottle" as string | null } });
    expect(document.title).toBe("(1) Kári challenges you · Wottle");
    rerender({ t: null });
    expect(document.title).toBe("lobby · Wottle");
  });
});

describe("useNotifications", () => {
  let hidden = false;
  const created: string[] = [];
  class FakeNotification {
    static permission: NotificationPermission = "default";
    static requestPermission = vi.fn(async () => {
      FakeNotification.permission = "granted";
      return "granted" as NotificationPermission;
    });
    constructor(title: string) {
      created.push(title);
    }
  }
  beforeEach(() => {
    FakeNotification.permission = "default";
    FakeNotification.requestPermission.mockClear();
    created.length = 0;
    hidden = false;
    vi.stubGlobal("Notification", FakeNotification);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never asks on load; asks only when enabled, and remembers the opt-in", async () => {
    const { result } = renderHook(() => useNotifications());
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
    await act(async () => void (await result.current.enable()));
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem("wottle.notifications")).toBe("on");
  });

  it("shows a notification only while the tab is hidden", async () => {
    const { result } = renderHook(() => useNotifications());
    await act(async () => void (await result.current.enable()));
    act(() => result.current.notify("Kári challenges you"));
    expect(created).toEqual([]);
    hidden = true;
    act(() => result.current.notify("Kári challenges you"));
    expect(created).toEqual(["Kári challenges you"]);
  });

  it("is not offered when the browser has been told no", () => {
    FakeNotification.permission = "denied";
    const { result } = renderHook(() => useNotifications());
    expect(result.current.available).toBe(false);
  });
});
