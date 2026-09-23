import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/matchmaking/startQueue", () => ({ startQueueAction: vi.fn() }));
vi.mock("@/app/actions/matchmaking/cancelQueue", () => ({ cancelQueueAction: vi.fn().mockResolvedValue({ status: "cancelled" }) }));
vi.mock("@/app/actions/matchmaking/getMatchOverview", () => ({ getMatchOverviewAction: vi.fn() }));

import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { useMatchmaking } from "@/lib/room/useMatchmaking";

const kari = { id: "k", username: "kari", displayName: "Kári", status: "in_match" as const, lastSeenAt: "", eloRating: 1191 };

describe("useMatchmaking (spec 044 US8)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(startQueueAction).mockReset();
    vi.mocked(getMatchOverviewAction).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls the queue every 3 s and counts elapsed seconds while searching", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "queued" });
    const { result } = renderHook(() => useMatchmaking(true, Date.now()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(startQueueAction).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(startQueueAction).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ kind: "searching", elapsedSeconds: 3 });
  });

  it("matched → found with the opponent from the overview, and polling stops", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "matched", matchId: "m1" });
    vi.mocked(getMatchOverviewAction).mockResolvedValue({ status: "ok", self: kari, opponent: kari });
    const { result } = renderHook(() => useMatchmaking(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toEqual({ kind: "found", matchId: "m1", opponent: kari });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(startQueueAction).toHaveBeenCalledTimes(1);
  });

  it("cancel leaves the queue and stops polling", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "queued" });
    const { result } = renderHook(() => useMatchmaking(true));
    await act(async () => {
      await result.current.cancel();
    });
    expect(cancelQueueAction).toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: "cancelled" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(startQueueAction).toHaveBeenCalledTimes(1);
  });

  it("sends the tab's attention with every poll (spec 069 R5)", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "queued" });
    renderHook(() => useMatchmaking(true, Date.now(), "en"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(startQueueAction).toHaveBeenCalledWith({ language: "en", attention: { visible: true, inputAgoMs: expect.any(Number) } });
  });
});

describe("useMatchmaking: the fair queue (spec 069 US4)", () => {
  let hidden = false;
  const beacon = vi.fn(() => true);
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(startQueueAction).mockReset().mockResolvedValue({ status: "queued" });
    vi.mocked(cancelQueueAction).mockClear();
    hidden = false;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    beacon.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  it("a hidden tab pauses the search at once and stops asking; resume ▸ asks again", async () => {
    const { result } = renderHook(() => useMatchmaking(true, Date.now()));
    await settle();
    hidden = true;
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(beacon).toHaveBeenCalledWith("/api/matchmaking/pause");
    expect(result.current.state).toEqual({ kind: "paused" });
    const asked = vi.mocked(startQueueAction).mock.calls.length;
    await settle(9_000);
    expect(startQueueAction).toHaveBeenCalledTimes(asked);
    hidden = false;
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.state).toEqual({ kind: "paused" });
    act(() => result.current.resume());
    await settle();
    expect(result.current.state.kind).toBe("searching");
    expect(startQueueAction).toHaveBeenCalledTimes(asked + 1);
  });

  it("at 3:00 asks whether to keep searching; an answer carries on", async () => {
    const { result } = renderHook(() => useMatchmaking(true, Date.now()));
    await settle(180_000);
    expect(result.current.state.kind).toBe("stillSearching");
    act(() => result.current.keepSearching());
    await settle(1_000);
    expect(result.current.state.kind).toBe("searching");
  });

  it("an unanswered check stops the search and leaves the queue", async () => {
    const { result } = renderHook(() => useMatchmaking(true, Date.now()));
    await settle(211_000);
    expect(result.current.state).toEqual({ kind: "stopped" });
    expect(cancelQueueAction).toHaveBeenCalledTimes(1);
  });

  it("the table-leave cooldown stops the search and counts down", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "cooldown", until: new Date(Date.now() + 60_000).toISOString() });
    const { result } = renderHook(() => useMatchmaking(true, Date.now()));
    await settle(1_000);
    expect(result.current.state).toMatchObject({ kind: "cooldown" });
    expect((result.current.state as { leftMs: number }).leftMs).toBeGreaterThan(55_000);
  });
});
