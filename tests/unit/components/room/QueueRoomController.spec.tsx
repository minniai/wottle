import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/actions/matchmaking/startQueue", () => ({ startQueueAction: vi.fn() }));
vi.mock("@/app/actions/matchmaking/cancelQueue", () => ({ cancelQueueAction: vi.fn().mockResolvedValue({ status: "cancelled" }) }));
vi.mock("@/app/actions/matchmaking/getMatchOverview", () => ({ getMatchOverviewAction: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabaseClient: () => ({ removeChannel: vi.fn() }) }));
vi.mock("@/lib/realtime/matchChannel", () => ({ subscribeToMatchChannel: () => ({ on: () => ({ on: vi.fn() }), unsubscribe: vi.fn() }) }));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: vi.fn() }));

import { getMatchOverviewAction } from "@/app/actions/matchmaking/getMatchOverview";
import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { QueueRoom, QueueRoomController } from "@/components/room/QueueRoomController";
import { useRoomStore } from "@/lib/room/roomStore";
import type { MatchState, PlayerIdentity } from "@/lib/types/match";
import { SEATED_TABLE } from "@/lib/match/table";

const me: PlayerIdentity = { id: "me", username: "birna", displayName: "Birna", status: "matchmaking", lastSeenAt: "", eloRating: 1204 };
const kari: PlayerIdentity = { id: "k", username: "kari", displayName: "Kári", status: "in_match", lastSeenAt: "", eloRating: 1191 };
const match: MatchState = {
  matchId: "m1",
  board: Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => "ÞÐÆÖÝABCDE"[(x + y) % 10])),
  state: "in_progress",
  players: {
    playerA: { playerId: "me", movesPlayed: 0, score: 0, inFlight: null, lastResolution: null },
    playerB: { playerId: "k", movesPlayed: 0, score: 0, inFlight: null, lastResolution: null },
  },
  clock: { startedAt: "2026-01-01T00:00:03.000Z", deadlineAt: "2026-01-01T00:05:03.000Z", serverNow: "2026-01-01T00:00:00.000Z" },
  moveLimit: 10,
  language: "is",
  resolvedSeq: 0,
  scores: { playerA: 0, playerB: 0 },
  frozenTiles: {},
  table: SEATED_TABLE,
  stakes: null,
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
    expect(screen.getByTestId("ledger-context")).toHaveTextContent("10 moves each · one 5:00 clock");
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
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent(/searching · \d+:\d\d · cancel ▸/);
    fireEvent.click(screen.getByTestId("ledger-cancel-queue"));
    expect(useRoomStore.getState().phase).toBe("lobby");
    expect(mockReplace).toHaveBeenCalledWith("/en/lobby");
  });

  it("a pairing goes to the table at the match's own address, as a new page (spec 069 FR-023)", async () => {
    vi.mocked(startQueueAction).mockResolvedValue({ status: "matched", matchId: "m1" });
    vi.mocked(getMatchOverviewAction).mockResolvedValue({ status: "ok", self: me, opponent: kari });
    render(<QueueRoom viewer={me} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(mockPush).toHaveBeenCalledWith("/en/match/m1");
    expect(mockReplace).not.toHaveBeenCalled();
    // The queue no longer counts a start of its own: the table does (spec 069 C1, C2).
    expect(screen.queryByText("starts in 3")).toBeNull();
  });

});

