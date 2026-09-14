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
  afterEach(() => vi.useRealTimers());

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
});
