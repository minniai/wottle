import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchPlayerProfiles, MatchState, RoundSummary } from "@/lib/types/match";

const mockCallbacks = vi.hoisted(() => ({
  onSummary: null as ((summary: RoundSummary) => void) | null,
  onState: null as ((state: MatchState) => void) | null,
  onRematch: null as ((event: import("@/lib/types/match").RematchEvent) => void) | null,
}));
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabaseClient: () => ({ removeChannel: vi.fn() }) }));
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: (_c: unknown, _m: string, cb: { onSummary?: (s: RoundSummary) => void; onState?: (s: MatchState) => void; onRematchEvent?: (e: import("@/lib/types/match").RematchEvent) => void }) => {
    mockCallbacks.onSummary = cb.onSummary ?? null;
    mockCallbacks.onState = cb.onState ?? null;
    mockCallbacks.onRematch = cb.onRematchEvent ?? null;
    return { on: () => ({ on: vi.fn() }), unsubscribe: vi.fn() };
  },
}));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: vi.fn() }));
vi.mock("@/app/actions/match/previewSwap", () => ({ previewSwap: vi.fn() }));
vi.mock("@/app/actions/match/resignMatch", () => ({ resignMatch: vi.fn().mockResolvedValue({ status: "ok" }) }));
vi.mock("@/app/actions/match/claimWin", () => ({ claimWinAction: vi.fn() }));
vi.mock("@/app/actions/match/triggerTimeoutCheck", () => ({ triggerTimeoutCheck: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/app/actions/match/getMatchRatings", () => ({ getMatchRatings: vi.fn() }));
vi.mock("@/app/actions/match/requestRematch", () => ({ requestRematchAction: vi.fn().mockResolvedValue({ status: "pending" }) }));
vi.mock("@/app/actions/match/respondToRematch", () => ({ acceptRematchAction: vi.fn().mockResolvedValue({ status: "accepted", matchId: "m2" }), declineRematchAction: vi.fn().mockResolvedValue({ status: "declined" }) }));
vi.mock("@/app/actions/match/cancelRematch", () => ({ cancelRematchAction: vi.fn().mockResolvedValue(undefined) }));

import { MatchRoomController } from "@/components/room/MatchRoomController";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { getMatchRatings } from "@/app/actions/match/getMatchRatings";
import { requestRematchAction } from "@/app/actions/match/requestRematch";
import type { RematchEvent } from "@/lib/types/match";
import { useRoomStore } from "@/lib/room/roomStore";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

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
    mockReplace.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "accepted", grid: state().board }) }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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
    // The board's A is worth 1 (spec 045 B3: the value was hard-coded to 0).
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(`picking · A (${LETTER_SCORING_VALUES_IS.A})`);
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
    vi.useFakeTimers();
    renderController();
    fireEvent.click(cell(0, 0));
    fireEvent.click(cell(1, 0));
    act(() => mockCallbacks.onSummary!(summary));
    act(() => mockCallbacks.onState!(state({ currentRound: 4, lastSummary: summary, scores: summary.totals })));
    act(() => vi.advanceTimersByTime(2_100)); // reveal settles
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

  it("final: the field stays, the ledger states the verdict once, bars carry rating lines, actions rematch · new opponent · lobby", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "ok", ratings: [
      { playerId: "player-1", ratingBefore: 1191, ratingAfter: 1203, ratingDelta: 12, kFactor: 32, matchResult: "win" },
      { playerId: "player-2", ratingBefore: 1204, ratingAfter: 1192, ratingDelta: -12, kFactor: 32, matchResult: "loss" },
    ] });
    renderController(state({ state: "completed", currentRound: 10, scores: { playerA: 170, playerB: 127 }, frozenTiles: { "0,0": { owner: "player_a" }, "1,0": { owner: "player_b" } }, disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z" }));
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "final");
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId("field")).toBeInTheDocument();
    expect(screen.getByTestId("verdict")).toHaveTextContent("Alice wins 170–127");
    expect(screen.getByTestId("verdict")).toHaveTextContent("by 43 points · 0 words to 0 · territory 1–1");
    expect(screen.getByTestId("round-indicator")).toHaveTextContent(/final · 10 rounds · \d+:\d\d/);
    expect(screen.getByTestId("player-bar-top")).not.toHaveTextContent("reconnecting");
    await waitFor(() => expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("1191 → 1203 · +12 · wins"));
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("1204 → 1192 · −12");
    expect(screen.getByTestId("ledger-rematch")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-new-opponent")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-lobby")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("final: rating pending until the server has written ratings", () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed", scores: { playerA: 90, playerB: 90 } }));
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("rating pending");
    expect(screen.getByTestId("verdict")).toHaveTextContent("draw 90–90");
  });

  it("final: an incoming rematch request is a ledger line; accept ▸ moves to the new match; rematch ▸ asks", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed" }));
    const event: RematchEvent = { type: "rematch-request", matchId: "m1", requesterId: "player-2", status: "pending" };
    act(() => mockCallbacks.onRematch!(event));
    expect(screen.getByTestId("notice-accept-rematch")).toBeInTheDocument();
    expect(screen.getAllByTestId("ledger-notice").some((n) => n.textContent?.includes("Bob asks for a rematch"))).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId("notice-accept-rematch"));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/match/m2"));
  });

  it("final: rematch ▸ sends the request and shows waiting for the opponent", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed" }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("ledger-rematch"));
    });
    expect(requestRematchAction).toHaveBeenCalledWith("m1");
    await waitFor(() => expect(screen.getAllByTestId("ledger-notice").some((n) => n.textContent?.includes("waiting for Bob"))).toBe(true));
  });

  it("read-only non-participant: player A is the bottom seat without · you, field disabled, only ◂ lobby", () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    render(<MatchRoomController initialState={state({ state: "completed" })} currentPlayerId="stranger" matchId="m1" playerProfiles={profiles} />);
    expect(screen.getByTestId("player-bar-bottom")).toHaveTextContent("Alice");
    expect(screen.getByTestId("ledger-header")).not.toHaveTextContent("· you");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    expect(screen.queryByTestId("ledger-rematch")).toBeNull();
    expect(screen.getByTestId("ledger-lobby")).toBeInTheDocument();
  });

  it("opponent disconnect: sub-line counts down from the server anchor, lane dashed, both clocks hold, no overlay", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    renderController(state({ disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z", reconnectWindowMs: 90_000 }));
    const top = screen.getByTestId("player-bar-top");
    expect(top).toHaveTextContent("reconnecting · 1:20 left");
    expect(top.querySelector('[data-testid="player-bar-lane"]')).toHaveAttribute("data-mode", "disconnected");
    expect(screen.getByTestId("player-bar-bottom").querySelector('[data-testid="player-bar-clock"]')).toHaveAttribute("data-running", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(top).toHaveTextContent("reconnecting · 1:18 left");
    vi.useRealTimers();
  });

  it("once the window has elapsed the ledger offers the claim as a line", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
    renderController(state({ disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z", reconnectWindowMs: 90_000 }));
    expect(screen.getByTestId("notice-claim-win")).toBeInTheDocument();
    expect(screen.getByTestId("player-bar-top")).toHaveTextContent("reconnecting · 0:00 left");
    vi.useRealTimers();
  });

  it("frozen letters carry the scorer's seat and a tap writes the frozen notice", () => {
    renderController(state({ frozenTiles: { "2,2": { owner: "player_b" } } }));
    expect(cell(2, 2)).toHaveAttribute("data-state", "frozen");
    expect(cell(2, 2)).toHaveAttribute("data-seat", "opp");
    fireEvent.click(cell(2, 2));
    expect(screen.getByTestId("ledger-notice")).toHaveTextContent("frozen · Bob R3 · pick another");
  });

  it("the frozen notice names the round the letter froze in, not the current one", () => {
    // Round 4 is live; the letter at 1,2 froze in round 3 with `þar` (spec 045 B4).
    renderController(state({ currentRound: 4, lastSummary: summary, frozenTiles: { "1,2": { owner: "player_a" } } }));
    fireEvent.click(cell(1, 2));
    expect(screen.getByTestId("ledger-notice")).toHaveTextContent("frozen · Alice R3 · pick another");
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

  it("reveal: bands draw one at a time, words land in the row as each lands, then everything settles", () => {
    vi.useFakeTimers();
    renderController(state({ currentRound: 3 }));
    act(() => mockCallbacks.onSummary!(summary));
    // Nothing drawn at t=0 before the first band step runs.
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
    expect(screen.getAllByTestId("field-band")[0]).toHaveClass("field__band--drawing");
    expect(screen.getByTestId("ledger-row-3").textContent).not.toContain("þar");
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId("ledger-row-3").textContent).toContain("þar");
    act(() => vi.advanceTimersByTime(120));
    expect(screen.getAllByTestId("field-band")).toHaveLength(2);
    expect(screen.getAllByTestId("field-band")[1]).toHaveClass("field__band--live");
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId("ledger-row-3").textContent).toContain("orð");
    act(() => vi.advanceTimersByTime(1_200)); // t ≥ 2040: settle
    expect(screen.getAllByTestId("field-band").every((b) => b.classList.contains("field__band--settled"))).toBe(true);
    vi.useRealTimers();
  });

  it("reveal under reduced motion: end state immediately", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    renderController(state({ currentRound: 3 }));
    act(() => mockCallbacks.onSummary!(summary));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getAllByTestId("field-band")).toHaveLength(2);
    expect(screen.getByTestId("ledger-row-3").textContent).toContain("orð");
    vi.useRealTimers();
  });

  it("words revealed by the first-mover partial are not drawn again at resolution (Q3)", () => {
    vi.useFakeTimers();
    renderController(state({ currentRound: 3 }));
    const partial = { matchId: "m1", roundNumber: 3, firstMoverId: "player-1", firstSubmissionAt: "2026-01-01T00:00:00Z", words: [summary.words[0]], delta: { playerA: 15, playerB: 0 }, frozenTiles: {} };
    act(() => mockCallbacks.onState!(state({ currentRound: 3, partialSummary: partial })));
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
    act(() => mockCallbacks.onSummary!(summary));
    act(() => vi.advanceTimersByTime(0));
    // The first mover's band stays; only the second word draws.
    const bands = screen.getAllByTestId("field-band");
    expect(bands).toHaveLength(2);
    expect(bands.filter((b) => b.classList.contains("field__band--drawing"))).toHaveLength(1);
    expect(bands.find((b) => b.classList.contains("field__band--drawing"))).toHaveAttribute("data-word", "orð");
    vi.useRealTimers();
  });
});

