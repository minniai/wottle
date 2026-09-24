import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const channel = vi.hoisted(() => ({ onEvent: null as null | ((e: string, p: Record<string, unknown>) => void), onJoined: null as null | ((j: boolean) => void), topic: "" }));
vi.mock("@/lib/realtime/broadcast", () => ({
  subscribeBroadcast: vi.fn((topic: string, onEvent: (e: string, p: Record<string, unknown>) => void, onJoined: (j: boolean) => void) => {
    channel.topic = topic;
    channel.onEvent = onEvent;
    channel.onJoined = onJoined;
    return () => undefined;
  }),
}));

import { useLobbyList } from "@/components/standing/hooks/useLobbyList";

const ROW = { playerId: "00000000-0000-4000-8000-000000000001", displayName: "Kári", handle: "kári", rating: 1179, state: "here", movesPlayed: null, record: null };

/** Spec 070 US2 (T051): the lobby list follows pokes, with a poll behind them. */
describe("useLobbyList", () => {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ rows: [ROW] }), { status: 200 }));
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  it("reads the lobby's rows on mount, from its own topic", async () => {
    const { result } = renderHook(() => useLobbyList("en", []));
    await settle();
    expect(channel.topic).toBe("lobby:en");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/lobby/players?language=en");
    expect(result.current).toEqual([ROW]);
  });

  it("polls every 3s without a channel and every 12s with one", async () => {
    renderHook(() => useLobbyList("is", []));
    await settle();
    await settle(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => channel.onJoined!(true));
    await settle();
    const count = fetchMock.mock.calls.length;
    await settle(11_000);
    expect(fetchMock).toHaveBeenCalledTimes(count);
    await settle(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(count + 1);
  });

  it("reads again on a poke, and once more after a leaving tab's grace", async () => {
    renderHook(() => useLobbyList("is", []));
    await settle();
    act(() => channel.onJoined!(true));
    await settle();
    const count = fetchMock.mock.calls.length;
    await act(async () => {
      channel.onEvent!("presence", { recheckInMs: 8_500 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(count + 1);
    await settle(8_500);
    expect(fetchMock).toHaveBeenCalledTimes(count + 2);
  });
});
