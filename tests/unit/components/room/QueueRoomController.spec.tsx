import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace, push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/actions/matchmaking/startQueue", () => ({ startQueueAction: vi.fn() }));
vi.mock("@/app/actions/matchmaking/cancelQueue", () => ({ cancelQueueAction: vi.fn().mockResolvedValue({ status: "cancelled" }) }));
vi.mock("@/app/actions/matchmaking/getMatchOverview", () => ({ getMatchOverviewAction: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabaseClient: () => ({ removeChannel: vi.fn() }) }));
vi.mock("@/lib/realtime/matchChannel", () => ({ subscribeToMatchChannel: () => ({ on: () => ({ on: vi.fn() }), unsubscribe: vi.fn() }) }));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: vi.fn() }));
vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn() }));

import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { QueueRoomController } from "@/components/room/QueueRoomController";
import { useRoomStore } from "@/lib/room/roomStore";
import type { MatchState, PlayerIdentity } from "@/lib/types/match";

const me: PlayerIdentity = { id: "me", username: "birna", displayName: "Birna", status: "matchmaking", lastSeenAt: "", eloRating: 1204 };
const kari: PlayerIdentity = { id: "k", username: "kari", displayName: "Kári", status: "in_match", lastSeenAt: "", eloRating: 1191 };
const match: MatchState = {
  matchId: "m1",
  board: Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => "ÞÐÆÖÝABCDE"[(x + y) % 10])),
  currentRound: 1,
  state: "collecting",
  timers: { playerA: { playerId: "me", remainingMs: 300_000, status: "running" }, playerB: { playerId: "k", remainingMs: 300_000, status: "running" } },
  scores: { playerA: 0, playerB: 0 },
};

describe("QueueRoomController (spec 044 US8, Q3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoomStore.getState().leaveToLobby();
    useRoomStore.setState({ viewer: me, board: [] });
    vi.mocked(startQueueAction).mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => match }));
    vi.stubGlobal("history", { ...window.history, replaceState: vi.fn() });
    mockReplace.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("searching: top bar reads Finding an opponent with a searching lane; letters land ~100 ms apart; cancel returns to the lobby", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "queued" });
    render(<QueueRoomController viewer={me} />);
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "queue");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("Finding an opponent");
    expect(screen.getByTestId("player-bar-top").querySelector('[data-testid="player-bar-lane"]')).toHaveAttribute("data-mode", "searching");
    expect(screen.getByTestId("round-indicator")).toHaveTextContent("10 rounds · 5:00 clocks");
    const letterAt = (i: number) => screen.getAllByRole("gridcell")[i].querySelector("span")?.textContent;
    expect(letterAt(5)).toBe("");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(letterAt(5)).not.toBe("");
    expect(letterAt(60)).toBe("");
    // Spec 045 B7: the progress is a live row, as Fig. 7 draws it; the hint
    // keeps the queue's context line.
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(/setting the field · \d+ of 100 letters/);
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent(/ranked · \d+:\d\d · cancel ▸/);
    fireEvent.click(screen.getByTestId("ledger-cancel-queue"));
    expect(useRoomStore.getState().phase).toBe("lobby");
    expect(mockReplace).toHaveBeenCalledWith("/lobby");
  });

  it("found: the opponent writes into the top bar, letters swap to the real board, round 1 counts down, then the match phase renders", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "matched", matchId: "m1" });
    vi.mocked(getMatchOverviewAction).mockResolvedValue({ status: "ok", self: me, opponent: kari });
    render(<QueueRoomController viewer={me} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "found");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("Kári");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("round 1 in 3");
    expect(screen.getAllByRole("gridcell")[0].querySelector("span")?.textContent).toBe("Þ");
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/match/m1");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("round 1 in 2");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "match");
    expect(screen.getByTestId("room")).toHaveAttribute("data-match-id", "m1");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("1191 · opponent");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
