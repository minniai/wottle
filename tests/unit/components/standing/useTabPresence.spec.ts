import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { matchOf, pageOf, useTabPresence } from "@/components/standing/hooks/useTabPresence";

/** Spec 070 US6 (T033): one heartbeat per tab, faster while visible, and a beacon on the way out. */
describe("useTabPresence", () => {
  let hidden = false;
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ cadenceMs: 10_000 }), { status: 200 }));
  const beacon = vi.fn(() => true);

  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    beacon.mockClear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));

  it("beats at once and every 10s while visible, with the tab, its visibility, input and page", async () => {
    renderHook(() => useTabPresence("lobby"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/presence/beat");
    const first = bodies()[0];
    expect(first).toMatchObject({ visible: true, page: "lobby" });
    expect(first.tabId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof first.inputAgoMs).toBe("number");
    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("names the match it is on, and beats again when the match changes (spec 071 R5)", async () => {
    const M1 = "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11";
    const M2 = "6e3d2d2f-9e1f-4c9f-8e6f-3e9a2e1d8b22";
    const { rerender } = renderHook(({ matchId }) => useTabPresence("match", matchId), { initialProps: { matchId: M1 as string | null } });
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(bodies()[0]).toMatchObject({ page: "match", matchId: M1 });
    rerender({ matchId: M2 });
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(bodies()[1]).toMatchObject({ page: "match", matchId: M2 });
  });

  it("keeps the same tab id across a reload of the tab", async () => {
    const one = renderHook(() => useTabPresence("lobby"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    one.unmount();
    renderHook(() => useTabPresence("rules"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    const [a, b] = bodies();
    expect(b.tabId).toBe(a.tabId);
    expect(b.page).toBe("rules");
  });

  it("falls back to an id in memory when session storage throws", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderHook(() => useTabPresence("lobby"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(bodies()[0].tabId).toMatch(/^[0-9a-f-]{36}$/);
    spy.mockRestore();
  });

  it("beats at once when the tab hides, then every 30s", async () => {
    renderHook(() => useTabPresence("lobby"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    hidden = true;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(bodies().at(-1)).toMatchObject({ visible: false });
    const count = fetchMock.mock.calls.length;
    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)));
    expect(fetchMock.mock.calls.length).toBe(count);
    await act(async () => void (await vi.advanceTimersByTimeAsync(10_000)));
    expect(fetchMock.mock.calls.length).toBe(count + 1);
  });

  it("sends the leaving beacon on pagehide, as text/plain JSON", async () => {
    renderHook(() => useTabPresence("lobby"));
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    window.dispatchEvent(new Event("pagehide"));
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/presence/leave");
    expect(blob.type).toContain("text/plain");
    vi.useRealTimers();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(JSON.parse(text).tabId).toBe(bodies()[0].tabId);
  });
});

describe("pageOf", () => {
  it.each([
    ["/", "lobby"],
    ["/en", "lobby"],
    ["/rules", "rules"],
    ["/en/rules", "rules"],
    ["/profile", "profile"],
    ["/en/profile/k%C3%A1ri", "profile"],
    ["/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11", "match"],
    ["/dev/page", "other"],
  ])("%s is %s", (path, page) => {
    expect(pageOf(path)).toBe(page);
  });
});

describe("matchOf", () => {
  it.each([
    ["/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11", "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11"],
    ["/en/match/5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11", "5d2c1c1e-8d0e-4b8e-9d5e-2d8f1d0c7a11"],
    ["/en/match/nope", null],
    ["/", null],
  ])("%s is on %s", (path, id) => {
    expect(matchOf(path)).toBe(id);
  });
});
