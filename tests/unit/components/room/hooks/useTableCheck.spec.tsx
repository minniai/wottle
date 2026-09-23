import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTableCheck } from "@/components/room/hooks/useTableCheck";

/** Spec 069 FR-025a: every room page asks every 3s whether a table waits. */
function answer(body: Record<string, unknown>) {
  return vi.fn(async () => new Response(JSON.stringify({ match: null, cooldownUntil: null, notice: null, ...body })));
}

describe("useTableCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks with the tab's attention, and again every 3s", async () => {
    const fetch = answer({});
    vi.stubGlobal("fetch", fetch);
    renderHook(() => useTableCheck({ enabled: true, attention: () => ({ visible: true, inputAgoMs: 1200 }), onTable: vi.fn() }));
    await act(async () => {});
    expect(fetch).toHaveBeenCalledWith("/api/match/active?visible=1&inputAgoMs=1200", { cache: "no-store" });
    await act(async () => void vi.advanceTimersByTime(3_000));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("takes the player to a waiting table, once per match", async () => {
    vi.stubGlobal("fetch", answer({ match: { id: "m1", state: "pending" } }));
    const onTable = vi.fn();
    renderHook(() => useTableCheck({ enabled: true, attention: () => ({ visible: true, inputAgoMs: 0 }), onTable }));
    await act(async () => {});
    await act(async () => void vi.advanceTimersByTime(3_000));
    expect(onTable).toHaveBeenCalledTimes(1);
    expect(onTable).toHaveBeenCalledWith("m1");
  });

  it("passes on the cooldown and a missed table's notice", async () => {
    vi.stubGlobal("fetch", answer({ cooldownUntil: "2026-09-23T12:05:00.000Z", notice: "table_missed" }));
    const onStatus = vi.fn();
    renderHook(() => useTableCheck({ enabled: true, attention: () => ({ visible: true, inputAgoMs: 0 }), onTable: vi.fn(), onStatus }));
    await act(async () => {});
    expect(onStatus).toHaveBeenCalledWith({ cooldownUntil: "2026-09-23T12:05:00.000Z", notice: "table_missed" });
  });

  it("asks nothing while disabled, and stops when unmounted", async () => {
    const fetch = answer({});
    vi.stubGlobal("fetch", fetch);
    const { rerender, unmount } = renderHook(({ enabled }) => useTableCheck({ enabled, attention: () => ({ visible: true, inputAgoMs: 0 }), onTable: vi.fn() }), { initialProps: { enabled: false } });
    await act(async () => void vi.advanceTimersByTime(6_000));
    expect(fetch).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(async () => {});
    unmount();
    await act(async () => void vi.advanceTimersByTime(6_000));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
