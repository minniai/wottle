import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const channel = vi.hoisted(() => ({ topic: "", onEvent: null as null | ((e: string) => void), onJoined: null as null | ((j: boolean) => void) }));
vi.mock("@/lib/realtime/broadcast", () => ({
  subscribeBroadcast: vi.fn((topic: string, onEvent: (e: string) => void, onJoined: (j: boolean) => void) => {
    Object.assign(channel, { topic, onEvent, onJoined });
    return () => undefined;
  }),
}));

import { useStandingFacts } from "@/components/standing/hooks/useStandingFacts";

const FACTS = { now: new Date().toISOString(), topic: "player:abc", lobbyLanguage: "is", incoming: [], outgoing: null, cooldowns: [], search: null, tableCooldownUntil: null, match: null, switchPending: null, notice: null, counts: { here: 0, searching: 0, playing: 0, otherHere: 0 }, viewer: { rating: 1200, gamesPlayed: 0 } };
const attention = () => ({ visible: true, inputAgoMs: 1234 });

/** Spec 070 T080: the standing read follows the player's own pokes, with a poll behind them. */
describe("useStandingFacts", () => {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(FACTS), { status: 200 }));
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

  it("reads with the tab's attention and listens on the topic it is given", async () => {
    const { result } = renderHook(() => useStandingFacts(attention));
    await settle();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/standing?visible=1&inputAgoMs=1234");
    expect(result.current.facts?.topic).toBe("player:abc");
    expect(channel.topic).toBe("player:abc");
  });

  it("re-reads on every poke and tells listeners its kind, never acting on a payload", async () => {
    const { result } = renderHook(() => useStandingFacts(attention));
    await settle();
    const heard: string[] = [];
    act(() => void result.current.onPoke((k) => heard.push(k)));
    const count = fetchMock.mock.calls.length;
    await act(async () => {
      channel.onEvent!("challenge");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.length).toBe(count + 1);
    expect(heard).toEqual(["challenge"]);
  });

  it("polls every 3s until the channel joins, then every 12s", async () => {
    renderHook(() => useStandingFacts(attention));
    await settle();
    await settle(3_000);
    const before = fetchMock.mock.calls.length;
    expect(before).toBeGreaterThanOrEqual(2);
    act(() => channel.onJoined!(true));
    await settle(11_000);
    expect(fetchMock.mock.calls.length).toBe(before);
    await settle(1_000);
    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });
});
