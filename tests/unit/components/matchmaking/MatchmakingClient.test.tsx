import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerIdentity } from "@/lib/types/match";

vi.mock("next/navigation", () => {
  const push = vi.fn();
  const replace = vi.fn();
  const router = { push, replace };
  return { useRouter: () => router };
});

vi.mock("@/app/actions/matchmaking/startQueue", () => ({
  startQueueAction: vi.fn(),
}));

vi.mock("@/app/actions/matchmaking/cancelQueue", () => ({
  cancelQueueAction: vi.fn(),
}));

vi.mock("@/app/actions/matchmaking/getMatchOverview", () => ({
  getMatchOverviewAction: vi.fn(),
}));

import { MatchmakingClient } from "@/components/matchmaking/MatchmakingClient";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { cancelQueueAction } from "@/app/actions/matchmaking/cancelQueue";
import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";

const startQueueMock = vi.mocked(startQueueAction);
const cancelQueueMock = vi.mocked(cancelQueueAction);
const overviewMock = vi.mocked(getMatchOverviewAction);

const SELF: PlayerIdentity = {
  id: "self",
  username: "ari",
  displayName: "Ari",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1234,
};

const OPPONENT: PlayerIdentity = {
  id: "opp",
  username: "birna",
  displayName: "Birna",
  avatarUrl: null,
  status: "matchmaking",
  lastSeenAt: new Date().toISOString(),
  eloRating: 1198,
};

beforeEach(() => {
  vi.useFakeTimers();
  startQueueMock.mockReset();
  cancelQueueMock.mockReset();
  overviewMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MatchmakingClient — searching phase", () => {
  test("renders the ring, elapsed counter, and cancel button", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<MatchmakingClient self={SELF} />);
    expect(screen.getByTestId("match-ring")).toBeInTheDocument();
    expect(screen.getByText(/Finding an opponent within/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cancel search/i }),
    ).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  test("expands the ±rating window by 50 points per second", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(/±250/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByText(/±350/)).toBeInTheDocument();
  });

  test("polls startQueueAction every 3 seconds while searching", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(startQueueMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(startQueueMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(startQueueMock).toHaveBeenCalledTimes(3);
  });

  test("cancel button calls cancelQueueAction and navigates to /lobby", async () => {
    startQueueMock.mockResolvedValue({ status: "queued" });
    cancelQueueMock.mockResolvedValue({ status: "cancelled" });
    const push = vi.fn();
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "useRouter").mockReturnValue({
      push,
      replace: vi.fn(),
    } as unknown as ReturnType<typeof navigation.useRouter>);

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    screen.getByRole("button", { name: /Cancel search/i }).click();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(cancelQueueMock).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/lobby");
  });
});

describe("MatchmakingClient — found/starting phases", () => {
  test("transitions to found when startQueueAction returns matched", async () => {
    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-123",
    });
    overviewMock.mockResolvedValueOnce({
      status: "ok",
      self: SELF,
      opponent: OPPONENT,
    });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/Opponent found/i)).toBeInTheDocument();
    expect(screen.getByText("Birna")).toBeInTheDocument();
  });

  test("transitions found → starting after 2.2s", async () => {
    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-123",
    });
    overviewMock.mockResolvedValueOnce({
      status: "ok",
      self: SELF,
      opponent: OPPONENT,
    });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_200);
    });
    expect(screen.getByText(/Starting match…/i)).toBeInTheDocument();
  });

  test("starting phase navigates to /match/:id after 1.4s", async () => {
    const push = vi.fn();
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "useRouter").mockReturnValue({
      push,
      replace: vi.fn(),
    } as unknown as ReturnType<typeof navigation.useRouter>);

    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-123",
    });
    overviewMock.mockResolvedValueOnce({
      status: "ok",
      self: SELF,
      opponent: OPPONENT,
    });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_200);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_400);
    });
    expect(push).toHaveBeenCalledWith("/match/match-123");
  });

  test("navigates straight to /match/:id when overview lookup fails", async () => {
    const push = vi.fn();
    const navigation = await import("next/navigation");
    vi.spyOn(navigation, "useRouter").mockReturnValue({
      push,
      replace: vi.fn(),
    } as unknown as ReturnType<typeof navigation.useRouter>);

    startQueueMock.mockResolvedValueOnce({
      status: "matched",
      matchId: "match-xyz",
    });
    overviewMock.mockResolvedValueOnce({ status: "error", message: "boom" });

    render(<MatchmakingClient self={SELF} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(push).toHaveBeenCalledWith("/match/match-xyz");
  });
});
