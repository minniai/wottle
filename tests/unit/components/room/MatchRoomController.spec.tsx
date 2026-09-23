import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchPlayerProfiles, MatchState, MoveResolution, PlayerMatchFacts, WordScore } from "@/lib/types/match";

const mockCallbacks = vi.hoisted(() => ({
  onMoveResolved: null as ((r: MoveResolution) => void) | null,
  onState: null as ((state: MatchState) => void) | null,
  onRematch: null as ((event: import("@/lib/types/match").RematchEvent) => void) | null,
}));
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabaseClient: () => ({ removeChannel: vi.fn() }) }));
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: (_c: unknown, _m: string, cb: { onMoveResolved?: (r: MoveResolution) => void; onState?: (s: MatchState) => void; onRematchEvent?: (e: import("@/lib/types/match").RematchEvent) => void }) => {
    mockCallbacks.onMoveResolved = cb.onMoveResolved ?? null;
    mockCallbacks.onState = cb.onState ?? null;
    mockCallbacks.onRematch = cb.onRematchEvent ?? null;
    return { on: () => ({ on: vi.fn() }), unsubscribe: vi.fn() };
  },
}));
vi.mock("@/app/actions/match/handleDisconnect", () => ({ handlePlayerDisconnect: vi.fn() }));
vi.mock("@/app/actions/match/resignMatch", () => ({ resignMatch: vi.fn().mockResolvedValue({ status: "ok" }) }));
vi.mock("@/app/actions/match/claimWin", () => ({ claimWinAction: vi.fn().mockResolvedValue({ status: "ok", matchId: "m1" }) }));
vi.mock("@/app/actions/match/settleMatch", () => ({ settleMatch: vi.fn().mockResolvedValue({ status: "ok", outcome: "not_due" }) }));
vi.mock("@/app/actions/match/getMatchRatings", () => ({ getMatchRatings: vi.fn() }));
vi.mock("@/app/actions/match/requestRematch", () => ({ requestRematchAction: vi.fn().mockResolvedValue({ status: "pending" }) }));
vi.mock("@/app/actions/match/respondToRematch", () => ({ acceptRematchAction: vi.fn().mockResolvedValue({ status: "accepted", matchId: "m2" }), declineRematchAction: vi.fn().mockResolvedValue({ status: "declined" }) }));
vi.mock("@/app/actions/match/cancelRematch", () => ({ cancelRematchAction: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/app/actions/auth/logout", () => ({ logoutAction: vi.fn().mockResolvedValue({ status: "ok" }) }));

import { __resetWordIntegrityForTests } from "@/lib/room/wordIntegrity";
import { MatchRoomController } from "@/components/room/MatchRoomController";
import { resignMatch } from "@/app/actions/match/resignMatch";
import { claimWinAction } from "@/app/actions/match/claimWin";
import { settleMatch } from "@/app/actions/match/settleMatch";
import { getMatchRatings } from "@/app/actions/match/getMatchRatings";
import { logoutAction } from "@/app/actions/auth/logout";
import { requestRematchAction } from "@/app/actions/match/requestRematch";
import type { RematchEvent } from "@/lib/types/match";
import { useRoomStore } from "@/lib/room/roomStore";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

const profiles: MatchPlayerProfiles = {
  playerA: { playerId: "player-1", displayName: "Alice", username: "alice", avatarUrl: null, eloRating: 1200 },
  playerB: { playerId: "player-2", displayName: "Bob", username: "bob", avatarUrl: null, eloRating: 1191 },
};

/** The words spell their runs on this board (spec 047 FR-002), so the integrity check stays silent. */
function board(): string[][] {
  const grid = Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => "ABCDEFGHIJ"[(x + y) % 10]));
  [..."ÞAR"].forEach((letter, i) => (grid[2][1 + i] = letter));
  [..."ORÐ"].forEach((letter, i) => (grid[5][5 + i] = letter));
  return grid;
}

const NOW = "2026-01-01T00:01:00.000Z";
const facts = (playerId: string, over: Partial<PlayerMatchFacts> = {}): PlayerMatchFacts => ({ playerId, movesPlayed: 2, score: 45, inFlight: null, lastResolution: null, ...over });

function state(overrides: Partial<MatchState> = {}, a: Partial<PlayerMatchFacts> = {}, b: Partial<PlayerMatchFacts> = {}): MatchState {
  return {
    matchId: "m1",
    board: board(),
    state: "in_progress",
    players: { playerA: facts("player-1", a), playerB: facts("player-2", { score: 30, movesPlayed: 5, ...b }) },
    clock: { startedAt: "2026-01-01T00:00:00.000Z", deadlineAt: "2026-01-01T00:05:00.000Z", serverNow: NOW },
    moveLimit: 10,
    language: "is",
    resolvedSeq: 7,
    scores: { playerA: 45, playerB: 30 },
    frozenTiles: {},
    ...overrides,
  };
}

const THAR: WordScore = { playerId: "player-1", word: "þar", length: 3, lettersPoints: 10, bonusPoints: 5, totalPoints: 15, coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }] };
const ORD: WordScore = { playerId: "player-2", word: "orð", length: 3, lettersPoints: 8, bonusPoints: 5, totalPoints: 13, coordinates: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }] };

function resolution(over: Partial<MoveResolution> = {}): MoveResolution {
  return {
    matchId: "m1", moveId: "mv-8", playerId: "player-1", globalSeq: 8, seq: 3, status: "resolved",
    swap: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, board: board(), words: [THAR], delta: 15,
    totals: { playerA: 60, playerB: 30 }, frozenTiles: { "1,2": { owner: "player_a" }, "2,2": { owner: "player_a" }, "3,2": { owner: "player_a" } },
    movesPlayed: { playerA: 3, playerB: 5 }, resolvedAt: NOW, ...over,
  };
}

const cell = (x: number, y: number) => screen.getAllByRole("gridcell").find((c) => c.getAttribute("data-x") === String(x) && c.getAttribute("data-y") === String(y))!;

function renderController(initial = state()) {
  return render(<MatchRoomController initialState={initial} currentPlayerId="player-1" matchId="m1" playerProfiles={profiles} />);
}

describe("MatchRoomController (spec 050)", () => {
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    mockPush.mockClear();
    mockReplace.mockClear();
    vi.mocked(claimWinAction).mockClear();
    vi.mocked(settleMatch).mockClear();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (String(url).endsWith("/state")) return useRoomStore.getState().match ?? state();
        if (String(url).endsWith("/words")) return { matchId: "m1", words: [] };
        return { status: "accepted", moveId: "mv-8", globalSeq: 8, receivedAt: NOW };
      },
    })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens your profile from the final menu while the result slip is visible", async () => {
    renderController(state({ state: "completed" }));
    await screen.findByTestId("slip-rematch");
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-profile"));
    expect(mockPush).toHaveBeenCalledWith("/en/profile");
    expect(screen.queryByTestId("slip")).toBeNull();
  });

  it("links both players to their own profiles", () => {
    renderController();
    expect(screen.getByRole("link", { name: "Alice, profile opens in a new tab" })).toHaveAttribute("href", "/en/profile/alice");
    expect(screen.getByRole("link", { name: "Bob, profile opens in a new tab" })).toHaveAttribute("href", "/en/profile/bob");
  });

  // Spec 049: the report is a warn event in every environment, once per match.
  it("reports a word record the board does not spell once per match as bands.record-mismatch", () => {
    __resetWordIntegrityForTests();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const wrong = resolution({ words: [{ ...THAR, word: "urg" }] });
    const { rerender } = renderController(state({}, { lastResolution: wrong, movesPlayed: 3 }));
    const lines = () => log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("bands.record-mismatch"));
    expect(lines()).toHaveLength(1);
    expect(JSON.parse(lines()[0])).toMatchObject({ matchId: "m1" });
    expect(lines()[0]).toContain("M3 urg: board spells ÞAR at (1,2)…(3,2)");
    rerender(<MatchRoomController initialState={state({ resolvedSeq: 9 }, { lastResolution: wrong, movesPlayed: 3 })} currentPlayerId="player-1" matchId="m1" playerProfiles={profiles} />);
    expect(lines()).toHaveLength(1);
    log.mockRestore();
  });

  it("renders the scoreboard (clock, opponent, you) above the field with the ledger, seats relative to the viewer (spec 068)", () => {
    renderController();
    const room = screen.getByTestId("room");
    expect(room).toHaveAttribute("data-phase", "match");
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("Bob");
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("1191 · 5 of 10 · playing");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("Alice");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("1200 · you · move 3 of 10");
    // 2026-09-21: the ledger names no move of the viewer's; the bottom bar's lane counts them.
    expect(screen.getByTestId("ledger-context")).toHaveTextContent("");
    expect(screen.getByTestId("scoreboard-row-you").querySelector('[data-testid="scoreboard-track"]')).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByTestId("scoreboard-clock")).toBeInTheDocument();
    // Spec 068: no player bars in the match; one box above the field, your row nearest the board.
    expect(screen.queryByTestId("player-bar-top")).toBeNull();
    expect(screen.queryByTestId("player-bar-bottom")).toBeNull();
    expect(room).toHaveAttribute("data-layout", "scoreboard");
    const ids = Array.from(room.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(ids.indexOf("scoreboard-clock")).toBeLessThan(ids.indexOf("scoreboard-row-opp"));
    expect(ids.indexOf("scoreboard-row-opp")).toBeLessThan(ids.indexOf("scoreboard-row-you"));
    expect(ids.indexOf("scoreboard-row-you")).toBeLessThan(ids.indexOf("field"));
  });

  it("before started_at the room counts 3·2·1 from the server anchor and takes no pick; the caption holds at 5:00", () => {
    renderController(state({ clock: { startedAt: "2026-01-01T00:00:03.000Z", deadlineAt: "2026-01-01T00:05:03.000Z", serverNow: "2026-01-01T00:00:01.000Z" } }, { movesPlayed: 0 }, { movesPlayed: 0 }));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("starts in 2");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("5:00");
    fireEvent.click(cell(0, 0));
    expect(cell(0, 0)).not.toHaveAttribute("data-state", "picked");
  });

  it("your move reads the beat; a pick adds the instruction; a commit reads scoring and locks the field", async () => {
    renderController();
    const live = () => screen.getByTestId("ledger-live-row");
    expect(live().querySelector(".ledger__live-line1")).toHaveTextContent("move 3 · your move");
    expect(live().querySelector(".ledger__live-line2")).toHaveTextContent("pick a letter");
    expect(screen.getByTestId("ledger-hint")).toHaveTextContent("");
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    fireEvent.click(cell(0, 0));
    expect(live().querySelector(".ledger__live-line1")).toHaveTextContent("move 3 · your move");
    expect(live().querySelector(".ledger__live-line2")).toHaveTextContent(`picking · A (${LETTER_SCORING_VALUES_IS.A}) · tap a second letter`);
    fireEvent.click(cell(1, 0));
    // The move is in flight: the field takes no pick and the frame returns to ink.
    await waitFor(() => expect(useRoomStore.getState().match?.players.playerA.inFlight ?? null).toBeNull());
    expect(live().querySelector(".ledger__live-line1")).toHaveTextContent("move 3 · your move");
    // Until the server acknowledges, the reducer holds the commit; the beat follows the store's inFlight.
    act(() => mockCallbacks.onState!(state({}, { inFlight: { moveId: "mv-8", globalSeq: 8, receivedAt: NOW } })));
    expect(live().querySelector(".ledger__live-line1")).toHaveTextContent("move 3 · scoring");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("move 3 of 10 · scoring");
  });

  it("the opponent's resolution lands live: their letters and band, their count, your pick cleared if touched", () => {
    vi.useFakeTimers();
    renderController();
    fireEvent.click(cell(5, 5));
    expect(cell(5, 5)).toHaveAttribute("data-state", "picked");
    const theirs = resolution({ moveId: "mv-9", playerId: "player-2", globalSeq: 8, seq: 6, words: [ORD], delta: 13, totals: { playerA: 45, playerB: 43 }, frozenTiles: { "5,5": { owner: "player_b" }, "6,5": { owner: "player_b" }, "7,5": { owner: "player_b" } }, movesPlayed: { playerA: 2, playerB: 6 }, swap: { from: { x: 9, y: 9 }, to: { x: 8, y: 8 } } });
    act(() => mockCallbacks.onMoveResolved!(theirs));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("6 of 10 · playing");
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-disabled");
    expect(cell(5, 5)).toHaveAttribute("data-state", "scored");
    // Spec 068 FR-031: pick cleared is the live row's second line for two seconds, not a notice.
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("pick cleared · Bob moved that letter");
    expect(screen.queryByTestId("ledger-notice")).toBeNull();
    act(() => vi.advanceTimersByTime(2_100));
    expect(screen.getByTestId("ledger-live-row")).not.toHaveTextContent("pick cleared");
    const band = screen.getAllByTestId("field-band").find((b) => b.getAttribute("data-word") === "orð");
    expect(band).toHaveAttribute("data-seat", "opp");
    expect(screen.getByTestId("ledger-row-6").querySelector('.ledger__words[data-seat="opp"]')).toHaveTextContent("orð");
    expect(screen.getByTestId("ledger-row-3")).toHaveAttribute("data-status", "live");
  });

  it("your resolution draws, holds 600ms as the scored row, then opens the next move", () => {
    vi.useFakeTimers();
    renderController(state({}, { inFlight: { moveId: "mv-8", globalSeq: 8, receivedAt: NOW } }));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 3 · scoring");
    act(() => mockCallbacks.onMoveResolved!(resolution()));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getAllByTestId("field-band")[0]).toHaveClass("field__band--drawing");
    // The held row says the move scored; its words land when the hold ends (§5.4).
    expect(screen.getByTestId("ledger-row-3")).toHaveAttribute("data-status", "settled");
    act(() => vi.advanceTimersByTime(1_100)); // band, count-up and settle
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 3 scored");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("you +15 · move 4 opens");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    act(() => vi.advanceTimersByTime(600)); // the move hold (spec 050 FR-013)
    expect(screen.getByTestId("ledger-row-3")).toHaveAttribute("data-status", "past");
    expect(screen.getByTestId("ledger-row-3").textContent).toContain("þar");
    expect(screen.getByTestId("ledger-row-4")).toHaveAttribute("data-status", "live");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 4 · your move");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("move 4 of 10");
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("60");
    expect(cell(1, 2)).toHaveAttribute("data-state", "scored");
    // Hovering a ledger row dims the other moves' bands.
    const bands = screen.getAllByTestId("field-band");
    fireEvent.mouseEnter(screen.getByTestId("ledger-row-1"));
    expect(bands[0]).toHaveClass("field__band--dimmed");
    fireEvent.mouseLeave(screen.getByTestId("ledger-row-1"));
    expect(bands[0]).not.toHaveClass("field__band--dimmed");
  });

  it("a refused move says why for two seconds, keeps the count and the frame, and holds nothing", () => {
    vi.useFakeTimers();
    renderController(state({}, { inFlight: { moveId: "mv-8", globalSeq: 8, receivedAt: NOW } }));
    act(() => mockCallbacks.onMoveResolved!(resolution({ status: "rejected", rejectionReason: "frozen", seq: null, words: [], delta: 0, totals: { playerA: 45, playerB: 30 }, frozenTiles: {}, movesPlayed: { playerA: 2, playerB: 5 } })));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 3 · your move");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("frozen · Bob froze it · pick another");
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-disabled");
    expect(useRoomStore.getState().holdMove).toBeNull();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("pick a letter");
  });

  it("resign is decided on a slip that names your move and the clock (spec 048 US7)", async () => {
    renderController();
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-resign"));
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveAttribute("data-kind", "resign");
    expect(slip).toHaveTextContent("Resign the match?");
    expect(slip).toHaveTextContent("Bob wins · your rating moves as a loss");
    expect(slip).toHaveTextContent(/move 3 of 10 · \d:\d\d left/);
    fireEvent.click(screen.getByTestId("slip-keep-playing"));
    expect(screen.queryByTestId("slip")).toBeNull();
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-resign"));
    fireEvent.click(screen.getByTestId("slip-confirm-resign"));
    expect(resignMatch).toHaveBeenCalledWith("m1");
    expect(screen.queryByTestId("slip")).toBeNull();
  });

  it("at 0:00 the client nudges settlement once and the live row reads time · scoring", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:06:00.000Z"));
    renderController(state({ clock: { startedAt: "2026-01-01T00:00:00.000Z", deadlineAt: "2026-01-01T00:05:00.000Z", serverNow: "2026-01-01T00:06:00.000Z" } }));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("time · scoring");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("0:00");
    expect(settleMatch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
  });

  it("with ten moves you watch: the field is locked and the live row waits for the opponent", () => {
    renderController(state({}, { movesPlayed: 10 }, { movesPlayed: 8 }));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("10 of 10 played");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(/Bob · 8 of 10 · \d:\d\d left/);
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("10 of 10 · done");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
  });

  it("final: the field stays, the ledger states the verdict once, bars carry rating lines, actions rematch · new opponent · lobby", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "ok", ratings: [
      { playerId: "player-1", ratingBefore: 1191, ratingAfter: 1203, ratingDelta: 12, kFactor: 32, matchResult: "win" },
      { playerId: "player-2", ratingBefore: 1204, ratingAfter: 1192, ratingDelta: -12, kFactor: 32, matchResult: "loss" },
    ] });
    renderController(state({ state: "completed", scores: { playerA: 170, playerB: 127 }, winnerId: "player-1", endedReason: "moves_complete", completedAt: "2026-01-01T00:04:52.000Z", frozenTiles: { "0,0": { owner: "player_a" }, "1,0": { owner: "player_b" } }, disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z" }, { movesPlayed: 10, score: 170 }, { movesPlayed: 10, score: 127 }));
    expect(screen.getByTestId("room")).toHaveAttribute("data-phase", "final");
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId("field")).toBeInTheDocument();
    expect(screen.getByTestId("verdict")).toHaveTextContent("Alice wins 170–127");
    expect(screen.getByTestId("verdict")).toHaveTextContent("by 43 points · 0 words to 0 · territory 1–1");
    // The scoreboard says the match is over and how long it ran; the caption holds the actions (spec 068).
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("4:52 of 5:00");
    expect(screen.getByTestId("ledger-caption-actions")).toHaveTextContent("lobby");
    // The scoreboard holds the time that was left (spec 068); no clock runs.
    expect(screen.getByTestId("scoreboard-clock")).toHaveAttribute("data-phase", "over");
    expect(screen.getByTestId("scoreboard-row-opp")).not.toHaveTextContent("reconnecting");
    await waitFor(() => expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("1191 → 1203 · +12 · wins"));
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("1204 → 1192 · −12");
    const slip = screen.getByTestId("slip");
    expect(slip).toHaveAttribute("data-kind", "matchOver");
    expect(slip).toHaveTextContent("Alice wins");
    expect(slip).toHaveTextContent("170 – 127");
    expect(slip).toHaveTextContent("match over · 4:52");
    expect(screen.getByTestId("slip-rematch")).toBeInTheDocument();
    expect(screen.getByTestId("slip-new-opponent")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-lobby")).toBeInTheDocument();
    expect(screen.queryByTestId("ledger-result")).toBeNull();
    fireEvent.click(screen.getByTestId("slip-review-field"));
    expect(screen.queryByTestId("slip")).toBeNull();
    fireEvent.click(screen.getByTestId("ledger-result"));
    expect(screen.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver");
  });

  it("final: when someone was short of ten the detail says so, the score decides, and the unplayed rows carry their penalties (rules §5.6)", () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed", scores: { playerA: 88, playerB: 124 }, winnerId: "player-2", endedReason: "incomplete" }, { movesPlayed: 10, score: 88 }, { movesPlayed: 8, score: 124 }));
    expect(screen.getByTestId("verdict")).toHaveTextContent("Bob wins 124–88");
    expect(screen.getByTestId("verdict")).toHaveTextContent("Bob played 8 of 10 · by 36 points");
    expect(screen.getByTestId("ledger-row-9").querySelector('[data-seat="opp"]')).toHaveAttribute("data-unplayed", "true");
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("rating pending");
  });

  it("final: both short of ten says neither finished, and the score still decides", () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed", scores: { playerA: 90, playerB: 60 }, winnerId: "player-1", endedReason: "both_incomplete" }, { movesPlayed: 6, score: 90 }, { movesPlayed: 3, score: 60 }));
    expect(screen.getByTestId("verdict")).toHaveTextContent("Alice wins 90–60");
    expect(screen.getByTestId("verdict")).toHaveTextContent("neither finished · by 30 points");
  });

  it("final: an incoming rematch request rewrites the slip's action line; accept ▸ moves to the new match; rematch ▸ asks", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed" }));
    const event: RematchEvent = { type: "rematch-request", matchId: "m1", requesterId: "player-2", status: "pending" };
    act(() => mockCallbacks.onRematch!(event));
    expect(await screen.findByTestId("slip-accept-rematch")).toBeInTheDocument();
    expect(screen.getByTestId("slip")).toHaveTextContent("Bob asks for a rematch");
    expect(screen.queryByTestId("ledger-notice")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId("slip-accept-rematch"));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/en/match/m2"));
  });

  it("final: rematch ▸ sends the request and shows waiting for the opponent", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed" }));
    const rematchButton = await screen.findByTestId("slip-rematch");
    await act(async () => {
      fireEvent.click(rematchButton);
    });
    expect(requestRematchAction).toHaveBeenCalledWith("m1");
    await waitFor(() => expect(screen.getByTestId("slip-rematch-waiting")).toHaveTextContent("waiting for Bob"));
  });

  it("read-only non-participant: player A is the bottom seat without · you, field disabled, only ◂ lobby", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    render(<MatchRoomController initialState={state({ state: "completed" })} currentPlayerId="stranger" matchId="m1" playerProfiles={profiles} />);
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("Alice");
    expect(screen.getByTestId("ledger-header")).not.toHaveTextContent("· you");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    expect(await screen.findByTestId("slip-lobby")).toBeInTheDocument();
    expect(screen.queryByTestId("slip-rematch")).toBeNull();
    expect(screen.getByTestId("ledger-lobby")).toBeInTheDocument();
  });

  it("opponent disconnect: sub-line counts down from the server anchor, lane dashed, the clock runs on, no overlay while you still play", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    renderController(state({ clock: { startedAt: "2026-01-01T00:00:00Z", deadlineAt: "2026-01-01T00:05:00Z", serverNow: "2026-01-01T00:00:10Z" }, disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z", reconnectWindowMs: 90_000 }));
    const top = screen.getByTestId("scoreboard-row-opp");
    expect(top).toHaveTextContent("reconnecting · 1:20 left");
    expect(top.querySelector('[data-testid="scoreboard-track"]')).toHaveAttribute("data-mode", "outlined");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("4:50");
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(top).toHaveTextContent("reconnecting · 1:18 left");
    expect(screen.getByTestId("scoreboard-clock")).toHaveTextContent("4:48");
    expect(screen.getByTestId("field")).toHaveAttribute("data-turn", "you");
    vi.useRealTimers();
  });

  it("the end-early slip is offered only once you have ten and the window is spent; keep waiting moves the offer to the live row for good (spec 068 FR-036)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
    // The server's clock agrees with the device's here; the window is measured on the server-corrected clock.
    const gone = { clock: { startedAt: "2026-01-01T00:00:00Z", deadlineAt: "2026-01-01T00:05:00Z", serverNow: "2026-01-01T00:02:00Z" }, disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z", reconnectWindowMs: 90_000 };
    const { unmount } = renderController(state(gone));
    expect(screen.queryByTestId("slip")).toBeNull();
    unmount();
    useRoomStore.getState().leaveToLobby();
    renderController(state(gone, { movesPlayed: 10 }, { movesPlayed: 6 }));
    expect(screen.getByTestId("slip")).toHaveAttribute("data-kind", "endEarly");
    expect(screen.getByTestId("slip")).toHaveTextContent("Bob is gone");
    expect(screen.getByTestId("slip")).toHaveTextContent("the normal rules decide it");
    fireEvent.click(screen.getByTestId("slip-keep-waiting"));
    expect(screen.queryByTestId("slip")).toBeNull();
    // Spec 068 FR-037: past the window the row counts how long they have been gone, never a frozen 0:00 left.
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("6 of 10 · gone for 0:30");
    // No re-raise: the slip stays down, and the offer is a secondary action on line 2.
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.queryByTestId("slip")).toBeNull();
    const offer = within(screen.getByTestId("ledger-live-row")).getByRole("button", { name: "end the match ▸" });
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("Bob is gone · end the match ▸");
    fireEvent.click(offer);
    expect(claimWinAction).toHaveBeenCalledWith("m1");
    act(() => mockCallbacks.onState!(state({}, { movesPlayed: 10 }, { movesPlayed: 6 })));
    expect(screen.queryByTestId("slip")).toBeNull();
  });

  // The client counts the window from its own clock and the snapshot's
  // disconnectedAt; the server's record can be a few ms younger. A `too_early`
  // answer is retried once the server's remaining time has passed.
  it("end the match ▸ answered too_early is retried after the server's remaining time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
    vi.mocked(claimWinAction).mockResolvedValueOnce({ status: "too_early", remainingMs: 51 });
    const gone = { disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z", reconnectWindowMs: 90_000 };
    renderController(state(gone, { movesPlayed: 10 }, { movesPlayed: 6 }));
    fireEvent.click(screen.getByTestId("slip-end-early"));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(claimWinAction).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(claimWinAction).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("too early")).toBeNull();
    vi.useRealTimers();
  });

  // Spec 047 amendment P1: an illegal pick is a live-row state for two seconds,
  // not a notice line — the beat stays in the one place the player is reading.
  it("frozen letters carry the scorer's seat; a tap writes the frozen state into the live row, then it clears", () => {
    vi.useFakeTimers();
    renderController(state({ frozenTiles: { "2,2": { owner: "player_b" } } }));
    expect(cell(2, 2)).toHaveAttribute("data-state", "frozen");
    expect(cell(2, 2)).toHaveAttribute("data-seat", "opp");
    fireEvent.click(cell(2, 2));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(/frozen · Bob M\d · pick another/);
    expect(screen.queryByTestId("ledger-notice")).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("pick a letter");
  });

  it("a legal pick supersedes the frozen state at once", () => {
    vi.useFakeTimers();
    renderController(state({ frozenTiles: { "2,2": { owner: "player_b" } } }));
    fireEvent.click(cell(2, 2));
    fireEvent.click(cell(0, 0));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(`picking · A (${LETTER_SCORING_VALUES_IS.A})`);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(`picking · A (${LETTER_SCORING_VALUES_IS.A})`);
  });

  it("the frozen state names the word the letter froze in, not the current move", () => {
    vi.useFakeTimers();
    // Your third move froze þar; the fourth is open. A reload holds nothing.
    const initial = state({ frozenTiles: { "1,2": { owner: "player_a" } } }, { movesPlayed: 3, lastResolution: resolution() });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).endsWith("/state") ? initial : String(url).endsWith("/words") ? { matchId: "m1", words: [] } : { status: "accepted" }) })));
    renderController(initial);
    act(() => vi.advanceTimersByTime(2_000)); // the reveal settles
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 4 · your move");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-disabled");
    fireEvent.click(cell(1, 2));
    // Spec 068 FR-030: the word it froze in, and its owner.
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("frozen · ÞAR · Alice · pick another");
    act(() => vi.advanceTimersByTime(2_000));
  });

  it("no rules line on a first match; the rules live on their own page (spec 048 US5)", () => {
    const first = { ...profiles, playerA: { ...profiles.playerA, gamesPlayed: 0 } };
    render(<MatchRoomController initialState={state()} currentPlayerId="player-1" matchId="m1" playerProfiles={first} />);
    expect(screen.queryByText(/Swap two letters/)).toBeNull();
    expect(screen.queryByTestId("ledger-rules")).toBeNull();
  });

  it("reveal under reduced motion: end state immediately", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduced-motion"), addEventListener() {}, removeEventListener() {} }));
    vi.useFakeTimers();
    renderController(state({}, { inFlight: { moveId: "mv-8", globalSeq: 8, receivedAt: NOW } }));
    act(() => mockCallbacks.onMoveResolved!(resolution()));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
    expect(screen.getAllByTestId("field-band")[0]).toHaveClass("field__band--settled");
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByTestId("ledger-row-3").textContent).toContain("þar");
    vi.useRealTimers();
  });

  it("a resolution already seen is not drawn again; the safety poll's snapshot behind it changes nothing", () => {
    vi.useFakeTimers();
    renderController(state({}, { inFlight: { moveId: "mv-8", globalSeq: 8, receivedAt: NOW } }));
    act(() => mockCallbacks.onMoveResolved!(resolution()));
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
    act(() => mockCallbacks.onMoveResolved!(resolution()));
    act(() => mockCallbacks.onState!(state({ resolvedSeq: 7 }, { inFlight: { moveId: "mv-8", globalSeq: 8, receivedAt: NOW } })));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getAllByTestId("field-band")).toHaveLength(1);
    expect(screen.getAllByTestId("field-band")[0]).not.toHaveClass("field__band--drawing");
    expect(useRoomStore.getState().match?.resolvedSeq).toBe(8);
    vi.useRealTimers();
  });

  /**
   * CI, 2026-09-15: every test passed and the run still failed. The ratings
   * retry called `.catch` on whatever the action returned and fired from a
   * timer after unmount, so a non-promise became an unhandled rejection with no
   * test left to attribute it to.
   */
  it("survives a ratings call that does not return a promise", async () => {
    vi.mocked(getMatchRatings).mockReturnValueOnce(undefined as never);
    const { unmount } = render(
      <MatchRoomController initialState={state({ state: "completed" })} currentPlayerId="player-1" matchId="m1" playerProfiles={profiles} />,
    );
    await waitFor(() => expect(getMatchRatings).toHaveBeenCalled());
    expect(screen.getByTestId("verdict")).toBeInTheDocument();
    unmount();
  });

  it("stops retrying ratings once unmounted", async () => {
    vi.useFakeTimers();
    vi.mocked(getMatchRatings).mockClear();
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "error" } as never);
    const { unmount } = render(
      <MatchRoomController initialState={state({ state: "completed" })} currentPlayerId="player-1" matchId="m1" playerProfiles={profiles} />,
    );
    await vi.waitFor(() => expect(getMatchRatings).toHaveBeenCalledTimes(1));

    unmount();
    const callsAtUnmount = vi.mocked(getMatchRatings).mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(vi.mocked(getMatchRatings).mock.calls.length).toBe(callsAtUnmount);
    vi.useRealTimers();
  });

  // Reported 2026-09-21: after a match, the ⋯ menu's profile and sign out did nothing.
  it("final: the ⋯ menu's profile opens your profile and sign out signs you out, with the slip up", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed", scores: { playerA: 88, playerB: 124 }, winnerId: "player-2", endedReason: "moves_complete" }, { movesPlayed: 10, score: 88 }, { movesPlayed: 10, score: 124 }));
    expect(await screen.findByTestId("slip", {}, { timeout: 3_000 })).toHaveAttribute("data-kind", "matchOver");
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-profile"));
    expect(mockPush).toHaveBeenCalledWith("/en/profile");
    fireEvent.click(screen.getByTestId("ledger-menu-trigger"));
    fireEvent.click(screen.getByTestId("ledger-menu-item-signout"));
    await waitFor(() => expect(logoutAction).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/en"));
  });

  it("a player's name opens their profile: in a live match in a new tab, after it in the same tab", () => {
    const live = renderController();
    const oppLive = screen.getByTestId("scoreboard-row-opp").querySelector("a")!;
    expect(oppLive).toHaveAttribute("href", "/en/profile/bob");
    expect(oppLive).toHaveAttribute("target", "_blank");
    expect(screen.getByTestId("scoreboard-row-you").querySelector("a")).toHaveAttribute("href", "/en/profile/alice");
    live.unmount();
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed", scores: { playerA: 88, playerB: 124 }, winnerId: "player-2", endedReason: "moves_complete" }, { movesPlayed: 10 }, { movesPlayed: 10 }));
    const oppFinal = screen.getByTestId("scoreboard-row-opp").querySelector("a")!;
    expect(oppFinal).toHaveAttribute("href", "/en/profile/bob");
    expect(oppFinal).not.toHaveAttribute("target");
  });

  it("lobby on the match-over slip takes the slip down before it navigates", async () => {
    vi.mocked(getMatchRatings).mockResolvedValue({ status: "not_found" });
    renderController(state({ state: "completed", scores: { playerA: 88, playerB: 124 }, winnerId: "player-2", endedReason: "moves_complete" }, { movesPlayed: 10 }, { movesPlayed: 10 }));
    await screen.findByTestId("slip", {}, { timeout: 3_000 });
    fireEvent.click(screen.getByTestId("slip-lobby"));
    expect(screen.queryByTestId("slip")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/en/lobby");
  });
});


describe("the reconnect window on the server-corrected clock (spec 068 R9)", () => {
  it("counts the opponent's window from the server's clock, not a wrong device clock", () => {
    vi.useFakeTimers();
    // The device runs 60s fast; the server says 30s have passed since the disconnect.
    vi.setSystemTime(new Date("2026-01-01T00:01:30Z"));
    renderController(state({ clock: { startedAt: "2026-01-01T00:00:00Z", deadlineAt: "2026-01-01T00:05:00Z", serverNow: "2026-01-01T00:00:30Z" }, disconnectedPlayerId: "player-2", disconnectedAt: "2026-01-01T00:00:00Z", reconnectWindowMs: 90_000 }));
    expect(screen.getByTestId("scoreboard-row-opp")).toHaveTextContent("reconnecting · 1:00 left");
    vi.useRealTimers();
  });
});

describe("the tab title (spec 068 FR-025)", () => {
  it("reads the clock, your move and the name while the match is live, and the name once you leave", () => {
    const { unmount } = renderController();
    expect(document.title).toMatch(/^\d:\d\d · move 3 · Wottle$/);
    unmount();
    expect(document.title).toBe("Wottle");
  });
});

describe("the last-moved tick (spec 068 FR-027)", () => {
  it("ticks the two cells of the opponent's last swap in their colour when it lands live", () => {
    renderController();
    act(() =>
      mockCallbacks.onMoveResolved!({
        matchId: "m1", moveId: "mv-9", playerId: "player-2", globalSeq: 20, seq: 6, status: "resolved",
        swap: { from: { x: 4, y: 4 }, to: { x: 5, y: 4 } }, board: state().board, words: [], delta: -5,
        totals: { playerA: 46, playerB: 10 }, frozenTiles: {}, movesPlayed: { playerA: 2, playerB: 6 }, resolvedAt: "2026-01-01T00:00:30Z",
      }),
    );
    const ticked = screen.getAllByTestId("field-cell").filter((c) => c.getAttribute("data-last-move") === "opp");
    expect(ticked.map((c) => `${c.getAttribute("data-x")},${c.getAttribute("data-y")}`)).toEqual(["4,4", "5,4"]);
    expect(ticked[0].getAttribute("aria-label")).toMatch(/Bob's last move$/);
  });
});

describe("the live row's second line in a match (spec 068 FR-029, FR-030)", () => {
  it("an illegal pick names the frozen word and its owner", async () => {
    vi.useFakeTimers();
    const words = { matchId: "m1", words: [{ ...ORD, moveSeq: 5, globalSeq: 7, playerId: "player-2", word: "orð", totalPoints: 13, coordinates: ORD.coordinates }] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).endsWith("/words") ? words : state({ frozenTiles: { "5,5": { owner: "player_b" } } })) })));
    renderController(state({ frozenTiles: { "5,5": { owner: "player_b" } } }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(cell(5, 5));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("frozen · ORÐ · Bob · pick another");
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("under a minute, with the move yours, line 2 is the stakes with only the number in crimson", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:04:12Z"));
    renderController(state({ clock: { startedAt: "2026-01-01T00:00:00Z", deadlineAt: "2026-01-01T00:05:00Z", serverNow: "2026-01-01T00:04:12Z" } }, { movesPlayed: 7, score: 69 }));
    const live = screen.getByTestId("ledger-live-row");
    expect(live).toHaveTextContent("3 moves left · −15 if unplayed");
    expect(live.querySelector(".points-lost")).toHaveTextContent("−15");
    vi.useRealTimers();
  });
});

describe("the room's polite region (spec 068 FR-033)", () => {
  it("announces the opponent's move as it lands live", () => {
    useRoomStore.getState().leaveToLobby();
    vi.useFakeTimers();
    renderController();
    act(() =>
      mockCallbacks.onMoveResolved!(
        resolution({ moveId: "mv-9", playerId: "player-2", globalSeq: 8, seq: 6, words: [ORD], delta: 13, totals: { playerA: 45, playerB: 43 }, frozenTiles: {}, movesPlayed: { playerA: 2, playerB: 6 }, swap: { from: { x: 9, y: 9 }, to: { x: 8, y: 8 } } }),
      ),
    );
    expect(screen.getByTestId("room-announcer")).toHaveTextContent("Bob ORÐ +13 · 6 of 10");
    expect(screen.getByTestId("room-announcer")).toHaveAttribute("aria-live", "polite");
    vi.useRealTimers();
  });
});

describe("focus at go (spec 068 FR-034)", () => {
  it("when the start count ends, focus moves to the field", async () => {
    useRoomStore.getState().leaveToLobby();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:01Z"));
    renderController(state({ clock: { startedAt: "2026-01-01T00:00:03.000Z", deadlineAt: "2026-01-01T00:05:03.000Z", serverNow: "2026-01-01T00:00:01.000Z" } }, { movesPlayed: 0 }, { movesPlayed: 0 }));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent(/starts in/);
    expect(document.activeElement?.getAttribute("data-testid")).not.toBe("field-cell");
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("move 1 · your move");
    expect(document.activeElement?.getAttribute("data-testid")).toBe("field-cell");
    vi.useRealTimers();
  });
});

describe("your own outage (spec 068 FR-038)", () => {
  it("offline: your row and the live row say so, the frame goes to ink and the field takes no pick", () => {
    useRoomStore.getState().leaveToLobby();
    renderController();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("scoreboard-row-you")).toHaveTextContent("offline · reconnecting");
    expect(screen.getByTestId("scoreboard-row-you").querySelector('[data-testid="scoreboard-track"]')).toHaveAttribute("data-mode", "outlined");
    expect(screen.getByTestId("ledger-live-row")).toHaveTextContent("offline · reconnecting");
    expect(screen.getByTestId("field")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("field")).not.toHaveAttribute("data-turn");
  });
});
