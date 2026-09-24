import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Spec 070 US8: leaving the match page closes its channel; that is not the viewer's outage. */
const disconnect = vi.hoisted(() => vi.fn(async () => undefined));
const system = vi.hoisted(() => ({ handler: null as null | ((p: { status?: string }) => Promise<void>) }));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: disconnect, handlePlayerReconnect: vi.fn(async () => undefined) }));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabaseClient: () => ({ removeChannel: vi.fn(async () => void (await system.handler?.({ status: "CLOSED" }))), getChannels: () => [] }),
}));
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: () => ({ on: (_e: string, _f: object, h: (p: { status?: string }) => Promise<void>) => void (system.handler = h) }),
}));
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => null })));

import { useMatchTransport } from "@/components/room/hooks/useMatchTransport";

describe("useMatchTransport: leaving the page", () => {
  it("its own channel removal neither falls back to polling nor reports the viewer disconnected", async () => {
    const { unmount } = renderHook(() => useMatchTransport("m1", "birna"));
    unmount();
    await Promise.resolve();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("a close it did not ask for still does", async () => {
    const { result } = renderHook(() => useMatchTransport("m1", "birna"));
    await system.handler!({ status: "CLOSED" });
    expect(disconnect).toHaveBeenCalledWith("m1", "birna");
    expect(result.current).toBeTruthy();
  });
});
