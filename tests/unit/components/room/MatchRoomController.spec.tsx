import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchPlayerProfiles, MatchState, RoundSummary } from "@/lib/types/match";

const mockCallbacks = vi.hoisted(() => ({
  onSummary: null as ((summary: RoundSummary) => void) | null,
  onState: null as ((state: MatchState) => void) | null,
}));
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabaseClient: () => ({ removeChannel: vi.fn() }) }));
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: (_c: unknown, _m: string, cb: { onSummary?: (s: RoundSummary) => void; onState?: (s: MatchState) => void }) => {
    mockCallbacks.onSummary = cb.onSummary ?? null;
    mockCallbacks.onState = cb.onState ?? null;
    return { on: () => ({ on: vi.fn() }), unsubscribe: vi.fn() };
  },
}));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: vi.fn() }));
vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn() }));
vi.mock("@/app/actions/match/resignMatch", () => ({ resignMatch: vi.fn().mockResolvedValue({ status: "ok" }) }));
vi.mock("@/app/actions/match/claimWin", () => ({ claimWinAction: vi.fn() }));
vi.mock("@/app/actions/match/triggerTimeoutCheck", () => ({ triggerTimeoutCheck: vi.fn().mockResolvedValue(undefined) }));

import { MatchRoomController } from "@/components/room/MatchRoomController";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { useRoomStore } from "@/lib/room/roomStore";

const profiles: MatchPlayerProfiles = {
  playerA: { playerId: "player-1", displayName: "Alice", username: "alice", avatarUrl: null, eloRating: 1200 },
  playerB: { playerId: "player-2", displayName: "Bob", username: "bob", avatarUrl: null, eloRating: 1191 },
};

function state(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: "m1",
    board: Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => "ABCDEFGHIJ"[(x + y) % 10])),
    currentRound: 3,
    state: "collecting",
    timers: {
      playerA: { playerId: "player-1", remainingMs: 180_000, status: "running" },
      playerB: { playerId: "player-2", remainingMs: 150_000, status: "running" },
    },
    scores: { playerA: 45, playerB: 30 },
    ...overrides,
  };
}

const summary: RoundSummary = {
  matchId: "m1",
  roundNumber: 3,
  words: [
    { playerId: "player-1", word: "þar", length: 3, lettersPoints: 10, bonusPoints: 5, totalPoints: 15, coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }] },
    { playerId: "player-2", word: "orð", length: 3, lettersPoints: 8, bonusPoints: 5, totalPoints: 13, coordinates: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }] },
  ],
  highlights: [],
  deltas: { playerA: 15, playerB: 13 },
  totals: { playerA: 60, playerB: 43 },
  resolvedAt: "2026-01-01T00:00:00Z",
  moves: [],
};

const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

function renderController(initial = state()) {
  return render(<MatchRoomController initialState={initial} currentPlayerId="player-1" matchId="m1" playerProfiles={profiles} />);
}

describe("MatchRoomController", () => {
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    mockPush.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "accepted", grid: state().board }) }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders opponent bar → field → your bar with the ledger, seats relative to the viewer", () => {
    renderController();
    const room = screen.getByTestId("room");
    expect(room).toHaveAttribute("data-phase", "match");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("Bob");
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("1191 · opponent");
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("Alice");
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("1200 · you");
    expect(screen.getByTestId("round-indicator")).toHaveTextContent("ranked · round 3 of 10");
    const ids = Array.from(room.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(ids.indexOf("player-bar-top")).toBeLessThan(ids.indexOf("field"));
    expect(ids.indexOf("field")).toBeLessThan(ids.indexOf("player-bar-bottom"));
  });

  it("second tap commits: your letters pin and the live row reads played", () => {
    renderController();
    fireEvent.click(cell(0, 0));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("picking · A");
    fireEvent.click(cell(1, 0));
    expect(cell(0, 0)).toHaveAttribute("data-state", "pinned");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("played ●");
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("played ●");
  });

  it("the opponent's pending move pins their letters in coral and shows the swapped letters", () => {
    renderController();
    const before = cell(0, 0).textContent;
    act(() => mockCallbacks.onState!(state({ pendingMoves: [{ playerId: "player-2", from: { x: 0, y: 0 }, to: { x: 9, y: 9 }, submittedAt: "2026-01-01T00:00:00Z" }] })));
    expect(cell(0, 0)).toHaveAttribute("data-state", "pinned");
    expect(cell(0, 0)).toHaveAttribute("data-seat", "opp");
    expect(cell(0, 0).textContent).not.toBe(before);
  });

  it("a scored round lands in its ledger row by seat and the round advance resets the field", () => {
    renderController();
    fireEvent.click(cell(0, 0));
    fireEvent.click(cell(1, 0));
    act(() => mockCallbacks.onSummary!(summary));
    act(() => mockCallbacks.onState!(state({ currentRound: 4, lastSummary: summary, scores: summary.totals })));
    const row = screen.getByTestId("ledger-row-3");
    const cells = row.querySelectorAll(".ledger__words");
    expect(cells[0].textContent).toContain("þar");
    expect(cells[1].textContent).toContain("orð");
    expect(screen.getByTestId("round-indicator")).toHaveTextContent("round 4 of 10");
    expect(cell(0, 0)).toHaveAttribute("data-state", "free");
    // Bands: one per word record, viewer-relative seats, chevron edge per direction.
    const bands = screen.getAllByTestId("field-band");
    expect(bands).toHaveLength(2);
    expect(bands.find((b) => b.getAttribute("data-word") === "þar")).toHaveAttribute("data-seat", "you");
    expect(bands.find((b) => b.getAttribute("data-word") === "orð")).toHaveAttribute("data-seat", "opp");
    expect(bands[0]).toHaveAttribute("data-direction", "ltr");
    expect(cell(1, 2)).toHaveAttribute("data-state", "scored");
    // Hovering a ledger row dims the other round's bands.
    fireEvent.mouseEnter(screen.getByTestId("ledger-row-1"));
    expect(bands[0]).toHaveClass("field__band--dimmed");
    fireEvent.mouseLeave(screen.getByTestId("ledger-row-1"));
    expect(bands[0]).not.toHaveClass("field__band--dimmed");
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("60");
  });

  it("dual timeout writes a notice line; resign flows through the live-row confirmation", async () => {
    renderController(state({ timers: { playerA: { playerId: "player-1", remainingMs: 0, status: "expired" }, playerB: { playerId: "player-2", remainingMs: 0, status: "expired" } } }));
    expect(screen.getByText(/both players timed out/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-resign"));
    expect(screen.getAllByTestId("ledger-notice").some((n) => n.textContent?.includes("resign the match?"))).toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByTestId("notice-confirm-resign"));
    expect(resignMatch).toHaveBeenCalledWith("m1");
  });

  it("does not show the disconnection modal for completed or pending matches and navigates to the summary when completed", () => {
    renderController(state({ state: "completed", disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z" }));
    expect(screen.queryByTestId("disconnection-modal")).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/match/m1/summary");
  });

  it("frozen letters carry the scorer's seat and a tap writes the frozen notice", () => {
    renderController(state({ frozenTiles: { "2,2": { owner: "player_b" } } }));
    expect(cell(2, 2)).toHaveAttribute("data-state", "frozen");
    expect(cell(2, 2)).toHaveAttribute("data-seat", "opp");
    fireEvent.click(cell(2, 2));
    expect(screen.getByTestId("ledger-notice")).toHaveTextContent("frozen · Bob R3 · pick another");
  });

  it("shows the rules line on a player's first match (gamesPlayed 0) and on ? rules", () => {
    const first = { ...profiles, playerA: { ...profiles.playerA, gamesPlayed: 0 } };
    render(<MatchRoomController initialState={state()} currentPlayerId="player-1" matchId="m1" playerProfiles={first} />);
    expect(screen.getAllByTestId("ledger-notice").some((n) => n.textContent?.startsWith("Swap two letters."))).toBe(true);
  });

  it("no rules line for a returning player until ? rules is pressed", () => {
    render(<MatchRoomController initialState={state()} currentPlayerId="player-1" matchId="m1" playerProfiles={{ ...profiles, playerA: { ...profiles.playerA, gamesPlayed: 12 } }} />);
    expect(screen.queryByText(/Swap two letters/)).toBeNull();
    fireEvent.click(screen.getByTestId("ledger-rules"));
    expect(screen.getByText(/Swap two letters/)).toBeInTheDocument();
  });
});
