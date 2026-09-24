import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Spec 068 FR-038, research R8: the viewer's own outage, noticed and recovered in place. */
const reconnect = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: vi.fn(async () => undefined), handlePlayerReconnect: reconnect }));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabaseClient: () => ({ removeChannel: vi.fn(async () => undefined), getChannels: () => [] }) }));
vi.mock("@/lib/realtime/matchChannel", () => ({ subscribeToMatchChannel: () => ({ on: () => undefined }) }));

import { useMatchTransport } from "@/components/room/hooks/useMatchTransport";

let online = true;
const snapshot = { matchId: "m1", resolvedSeq: 0 };

describe("useMatchTransport: your own outage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    online = true;
    reconnect.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => (online ? { ok: true, status: 200, json: async () => snapshot } : Promise.reject(new TypeError("offline")))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("two failed polls in a row mark you offline; the first good one brings you back, says how long, and clears your disconnect", async () => {
    const { result } = renderHook(() => useMatchTransport("m1", "birna"));
    expect(result.current.offline).toBe(false);
    online = false;
    await act(async () => vi.advanceTimersByTimeAsync(4_100));
    expect(result.current.offline).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(result.current.offline).toBe(true);
    online = true;
    await act(async () => vi.advanceTimersByTimeAsync(2_100));
    expect(result.current.offline).toBe(false);
    // From the first failed poll (t=2s) to the first good one (t≈26s).
    expect(result.current.awayMs).toBeGreaterThanOrEqual(22_000);
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(reconnect).toHaveBeenCalledWith("m1", "birna");
  });

  it("the browser saying it is offline counts at once", async () => {
    const { result } = renderHook(() => useMatchTransport("m1", "birna"));
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.offline).toBe(true);
  });

  it("a single failed poll is not an outage", async () => {
    const { result } = renderHook(() => useMatchTransport("m1", "birna"));
    online = false;
    await act(async () => vi.advanceTimersByTimeAsync(2_100));
    online = true;
    await act(async () => vi.advanceTimersByTimeAsync(2_100));
    expect(result.current.offline).toBe(false);
    expect(reconnect).not.toHaveBeenCalled();
  });
});
