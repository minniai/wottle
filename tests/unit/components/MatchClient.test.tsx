import { render, screen, act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { deriveScoreDelta } from "@/components/match/deriveScoreDelta";
import type { RoundSummary } from "@/lib/types/match";

import type { MatchState } from "@/lib/types/match";

const mockPush = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase browser client
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabaseClient: () => ({}),
}));

// Mock realtime channel
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: () => ({
    on: () => ({ on: vi.fn() }),
    unsubscribe: vi.fn(),
  }),
}));

// Mock disconnect action
vi.mock("@/app/actions/match/handleDisconnect", () => ({
  handlePlayerDisconnect: vi.fn(),
}));

function createMatchState(overrides?: Partial<MatchState>): MatchState {
  return {
    matchId: "match-test-123",
    board: Array.from({ length: 10 }, () => Array(10).fill("A")),
    currentRound: 3,
    state: "collecting",
    timers: {
      playerA: {
        playerId: "player-1",
        remainingMs: 180_000,
        status: "running",
      },
      playerB: {
        playerId: "player-2",
        remainingMs: 150_000,
        status: "running",
      },
    },
    scores: { playerA: 45, playerB: 30 },
    ...overrides,
  };
}

describe("MatchClient layout", () => {
  test("renders layout in order: opponent chrome → board → player chrome", async () => {
    const { MatchClient } = await import(
      "@/components/match/MatchClient"
    );

    const state = createMatchState();
    render(
      <MatchClient
        initialState={state}
        currentPlayerId="player-1"
        matchId="match-test-123"
      />,
    );

    const opponentChrome = screen.getByTestId("game-chrome-opponent");
    const board = screen.getByTestId("board-grid");
    const playerChrome = screen.getByTestId("game-chrome-player");

    expect(opponentChrome).toBeInTheDocument();
    expect(board).toBeInTheDocument();
    expect(playerChrome).toBeInTheDocument();

    // Verify DOM order: opponent before board before player
    const container = opponentChrome.closest("[data-testid='match-shell']");
    expect(container).toBeInTheDocument();
    const allTestIds = Array.from(
      container!.querySelectorAll("[data-testid]"),
    ).map((el) => el.getAttribute("data-testid"));

    const opponentIdx = allTestIds.indexOf("game-chrome-opponent");
    const boardIdx = allTestIds.indexOf("board-grid");
    const playerIdx = allTestIds.indexOf("game-chrome-player");

    expect(opponentIdx).toBeLessThan(boardIdx);
    expect(boardIdx).toBeLessThan(playerIdx);
  });

  test("does not render debug metadata when ?debug param is absent", async () => {
    const { MatchClient } = await import(
      "@/components/match/MatchClient"
    );

    render(
      <MatchClient
        initialState={createMatchState()}
        currentPlayerId="player-1"
        matchId="match-test-123"
      />,
    );

    expect(screen.queryByText("match-test-123")).not.toBeInTheDocument();
    expect(screen.queryByText(/Round limit/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("debug-metadata")).not.toBeInTheDocument();
  });

  test("renders debug metadata when ?debug=1 is in URL", async () => {
    // Override useSearchParams for this test
    const navModule = await import("next/navigation");
    vi.spyOn(navModule, "useSearchParams").mockReturnValue(
      new URLSearchParams("debug=1") as ReturnType<
        typeof navModule.useSearchParams
      >,
    );

    const { MatchClient } = await import(
      "@/components/match/MatchClient"
    );

    render(
      <MatchClient
        initialState={createMatchState()}
        currentPlayerId="player-1"
        matchId="match-test-123"
      />,
    );

    expect(screen.getByTestId("debug-metadata")).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  // T010: MatchClient navigates to /match/[id]/summary when state === "completed"
  test("T010: calls router.push to summary page when matchState.state is completed", async () => {
    mockPush.mockClear();
    const { MatchClient } = await import("@/components/match/MatchClient");

    const completedState = createMatchState({ state: "completed" });

    await act(async () => {
      render(
        <MatchClient
          initialState={completedState}
          currentPlayerId="player-1"
          matchId="match-test-123"
        />,
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/match/match-test-123/summary");
  });
});

// ─── deriveScoreDelta unit tests (T002–T007) ─────────────────────────────────

function makeSummary(overrides?: Partial<RoundSummary>): RoundSummary {
  return {
    matchId: "m1",
    roundNumber: 1,
    words: [],
    deltas: { playerA: 0, playerB: 0 },
    totals: { playerA: 0, playerB: 0 },
    highlights: [],
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("deriveScoreDelta", () => {
  // T002: returns null when letterPoints, lengthBonus, and combo are all zero
  test("T002: returns null when all point components are zero", () => {
    const summary = makeSummary({ words: [], comboBonus: { playerA: 0, playerB: 0 } });
    expect(deriveScoreDelta(summary, "player-1", "player_a")).toBeNull();
  });

  // T003: excludes words belonging to the opponent (filters by playerId)
  test("T003: excludes opponent words from the delta calculation", () => {
    const summary = makeSummary({
      words: [
        { playerId: "player-2", word: "abc", length: 3, lettersPoints: 10, bonusPoints: 5, totalPoints: 15, coordinates: [], isDuplicate: false },
      ],
      comboBonus: { playerA: 0, playerB: 0 },
    });
    // player-1 has no words → should be null
    expect(deriveScoreDelta(summary, "player-1", "player_a")).toBeNull();
  });

  // T004: excludes words where isDuplicate === true from all totals
  test("T004: excludes duplicate words from letter and length totals", () => {
    const summary = makeSummary({
      words: [
        { playerId: "player-1", word: "abc", length: 3, lettersPoints: 10, bonusPoints: 5, totalPoints: 0, coordinates: [], isDuplicate: true },
      ],
      comboBonus: { playerA: 0, playerB: 0 },
    });
    // Duplicate word should be excluded → null
    expect(deriveScoreDelta(summary, "player-1", "player_a")).toBeNull();
  });

  // T005: correctly sums lettersPoints and bonusPoints across all valid words
  test("T005: sums lettersPoints and bonusPoints across all non-duplicate player words", () => {
    const summary = makeSummary({
      words: [
        { playerId: "player-1", word: "ab", length: 2, lettersPoints: 4, bonusPoints: 3, totalPoints: 7, coordinates: [], isDuplicate: false },
        { playerId: "player-1", word: "cd", length: 2, lettersPoints: 6, bonusPoints: 2, totalPoints: 8, coordinates: [], isDuplicate: false },
        { playerId: "player-2", word: "ef", length: 2, lettersPoints: 99, bonusPoints: 99, totalPoints: 198, coordinates: [], isDuplicate: false },
      ],
      comboBonus: { playerA: 0, playerB: 0 },
    });
    const result = deriveScoreDelta(summary, "player-1", "player_a");
    expect(result).not.toBeNull();
    expect(result!.letterPoints).toBe(10); // 4 + 6
    expect(result!.lengthBonus).toBe(5);   // 3 + 2
  });

  // T006: reads comboBonus.playerA when slot is "player_a" and comboBonus.playerB when "player_b"
  test("T006: reads comboBonus.playerA for player_a slot", () => {
    const summary = makeSummary({
      words: [],
      comboBonus: { playerA: 15, playerB: 0 },
    });
    const result = deriveScoreDelta(summary, "player-1", "player_a");
    expect(result).not.toBeNull();
    expect(result!.combo).toBe(15);
  });

  test("T006b: reads comboBonus.playerB for player_b slot", () => {
    const summary = makeSummary({
      words: [],
      comboBonus: { playerA: 0, playerB: 20 },
    });
    const result = deriveScoreDelta(summary, "player-2", "player_b");
    expect(result).not.toBeNull();
    expect(result!.combo).toBe(20);
  });

  // T007: returns null when comboBonus is undefined and no scoreable words exist
  test("T007: returns null when comboBonus is undefined and words array is empty", () => {
    const summary = makeSummary({ words: [], comboBonus: undefined });
    expect(deriveScoreDelta(summary, "player-1", "player_a")).toBeNull();
  });
});
