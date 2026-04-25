import { render, screen, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { deriveScoreDelta } from "@/components/match/deriveScoreDelta";
import { deriveHighlightPlayerColors } from "@/components/match/deriveHighlightPlayerColors";
import type { MatchPlayerProfiles, MatchState, RoundSummary } from "@/lib/types/match";
import {
  PLAYER_A_HIGHLIGHT,
  PLAYER_B_HIGHLIGHT,
} from "@/lib/constants/playerColors";

// Hoisted mutable holder so the matchChannel mock can capture callbacks
const mockMatchCallbacks = vi.hoisted(() => ({
  onSummary: null as ((summary: RoundSummary) => void) | null,
  onState: null as ((state: MatchState) => void) | null,
}));

const mockPush = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase browser client — removeChannel is invoked on cleanup
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabaseClient: () => ({
    removeChannel: vi.fn(),
  }),
}));

// Mock realtime channel — captures onSummary for phase machine tests
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: (
    _client: unknown,
    _matchId: string,
    callbacks: {
      onSummary: (summary: RoundSummary) => void;
      onState?: (state: MatchState) => void;
      onOpponentLeave?: (presence: { playerId: string }) => void;
      presenceKey?: string;
    },
  ) => {
    mockMatchCallbacks.onSummary = callbacks.onSummary;
    mockMatchCallbacks.onState = callbacks.onState ?? null;
    return {
      on: () => ({ on: vi.fn() }),
      unsubscribe: vi.fn(),
    };
  },
}));

// Mock disconnect action
vi.mock("@/app/actions/match/handleDisconnect", () => ({
  handlePlayerDisconnect: vi.fn(),
}));

const defaultProfiles: MatchPlayerProfiles = {
  playerA: { playerId: "player-1", displayName: "Alice", username: "alice", avatarUrl: null, eloRating: 1200 },
  playerB: { playerId: "player-2", displayName: "Bob", username: "bob", avatarUrl: null, eloRating: 1200 },
};

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
        playerProfiles={defaultProfiles}
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
        playerProfiles={defaultProfiles}
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
        playerProfiles={defaultProfiles}
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
          playerProfiles={defaultProfiles}
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
    moves: [],
    ...overrides,
  };
}

describe("deriveScoreDelta", () => {
  test("T002: returns null when all point components are zero", () => {
    const summary = makeSummary({ words: [] });
    expect(deriveScoreDelta(summary, "player-1")).toBeNull();
  });

  test("T003: excludes opponent words from the delta calculation", () => {
    const summary = makeSummary({
      words: [
        { playerId: "player-2", word: "abc", length: 3, lettersPoints: 10, bonusPoints: 5, totalPoints: 15, coordinates: [] },
      ],
    });
    expect(deriveScoreDelta(summary, "player-1")).toBeNull();
  });

  test("T005: sums lettersPoints and bonusPoints across all player words", () => {
    const summary = makeSummary({
      words: [
        { playerId: "player-1", word: "ab", length: 2, lettersPoints: 4, bonusPoints: 3, totalPoints: 7, coordinates: [] },
        { playerId: "player-1", word: "cd", length: 2, lettersPoints: 6, bonusPoints: 2, totalPoints: 8, coordinates: [] },
        { playerId: "player-2", word: "ef", length: 2, lettersPoints: 99, bonusPoints: 99, totalPoints: 198, coordinates: [] },
      ],
    });
    const result = deriveScoreDelta(summary, "player-1");
    expect(result).not.toBeNull();
    expect(result!.letterPoints).toBe(10); // 4 + 6
    expect(result!.lengthBonus).toBe(5);   // 3 + 2
  });

  test("T007: returns null when words array is empty", () => {
    const summary = makeSummary({ words: [] });
    expect(deriveScoreDelta(summary, "player-1")).toBeNull();
  });
});

// ─── deriveHighlightPlayerColors unit tests (US2) ────────────────────────────

describe("deriveHighlightPlayerColors", () => {
  test("maps all coordinates of player A words to PLAYER_A_HIGHLIGHT", () => {
    const words = [
      {
        playerId: "player-1",
        word: "ABB",
        length: 3,
        lettersPoints: 10,
        bonusPoints: 5,
        totalPoints: 15,
        coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],

      },
    ];
    const result = deriveHighlightPlayerColors(words, "player-1");
    expect(result["1,2"]).toBe(PLAYER_A_HIGHLIGHT);
    expect(result["2,2"]).toBe(PLAYER_A_HIGHLIGHT);
    expect(result["3,2"]).toBe(PLAYER_A_HIGHLIGHT);
  });

  test("maps all coordinates of player B words to PLAYER_B_HIGHLIGHT", () => {
    const words = [
      {
        playerId: "player-2",
        word: "XYZ",
        length: 3,
        lettersPoints: 8,
        bonusPoints: 5,
        totalPoints: 13,
        coordinates: [{ x: 5, y: 5 }, { x: 6, y: 5 }],

      },
    ];
    const result = deriveHighlightPlayerColors(words, "player-1");
    expect(result["5,5"]).toBe(PLAYER_B_HIGHLIGHT);
    expect(result["6,5"]).toBe(PLAYER_B_HIGHLIGHT);
  });

  test("handles multiple words per player correctly", () => {
    const words = [
      {
        playerId: "player-1",
        word: "AB",
        length: 2,
        lettersPoints: 4,
        bonusPoints: 0,
        totalPoints: 4,
        coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }],

      },
      {
        playerId: "player-1",
        word: "CD",
        length: 2,
        lettersPoints: 6,
        bonusPoints: 0,
        totalPoints: 6,
        coordinates: [{ x: 3, y: 3 }, { x: 4, y: 3 }],

      },
      {
        playerId: "player-2",
        word: "EF",
        length: 2,
        lettersPoints: 5,
        bonusPoints: 0,
        totalPoints: 5,
        coordinates: [{ x: 7, y: 7 }],

      },
    ];
    const result = deriveHighlightPlayerColors(words, "player-1");
    expect(result["0,0"]).toBe(PLAYER_A_HIGHLIGHT);
    expect(result["1,0"]).toBe(PLAYER_A_HIGHLIGHT);
    expect(result["3,3"]).toBe(PLAYER_A_HIGHLIGHT);
    expect(result["4,3"]).toBe(PLAYER_A_HIGHLIGHT);
    expect(result["7,7"]).toBe(PLAYER_B_HIGHLIGHT);
  });

  test("same coordinate in two words uses last-write-wins (acceptable)", () => {
    const words = [
      {
        playerId: "player-1",
        word: "AB",
        length: 2,
        lettersPoints: 4,
        bonusPoints: 0,
        totalPoints: 4,
        coordinates: [{ x: 1, y: 1 }],

      },
      {
        playerId: "player-2",
        word: "CD",
        length: 2,
        lettersPoints: 4,
        bonusPoints: 0,
        totalPoints: 4,
        coordinates: [{ x: 1, y: 1 }],

      },
    ];
    const result = deriveHighlightPlayerColors(words, "player-1");
    // Either color is acceptable for a shared coordinate — just verify a color is present
    expect([PLAYER_A_HIGHLIGHT, PLAYER_B_HIGHLIGHT]).toContain(result["1,1"]);
  });
});

// ─── MatchClient animation phase machine tests (US2) ─────────────────────────

const mockRoundSummary: RoundSummary = {
  matchId: "match-test-123",
  roundNumber: 3,
  words: [
    {
      playerId: "player-1",
      word: "ÞAR",
      length: 3,
      lettersPoints: 10,
      bonusPoints: 5,
      totalPoints: 15,
      coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
    },
    {
      playerId: "player-2",
      word: "ORÐ",
      length: 3,
      lettersPoints: 8,
      bonusPoints: 5,
      totalPoints: 13,
      coordinates: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
    },
  ],
  highlights: [
    [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
    [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
  ],
  deltas: { playerA: 15, playerB: 13 },
  totals: { playerA: 60, playerB: 43 },
  resolvedAt: new Date().toISOString(),
  moves: [],
};

const mockRoundSummaryWithMoves: RoundSummary = {
  ...mockRoundSummary,
  moves: [
    { playerId: "player-1", from: { x: 2, y: 3 }, to: { x: 4, y: 3 }, submittedAt: "2026-01-01T00:00:00.000Z" },
    { playerId: "player-2", from: { x: 7, y: 1 }, to: { x: 7, y: 2 }, submittedAt: "2026-01-01T00:00:01.000Z" },
  ],
};

describe("MatchClient animation phase machine (US2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("RoundSummaryPanel is NOT rendered immediately when onSummary fires (animationPhase = highlighting)", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
  });

  test("no overlay is rendered after 1200ms — animation phase transitions back to idle", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1201);
    });

    // No overlay
    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
    // Animation phase returned to idle — scored tile highlights cleared
    const scoredTiles = document.querySelectorAll(".board-grid__cell--scored");
    expect(scoredTiles).toHaveLength(0);
  });

  test("scoredTileHighlights passed to BoardGrid is populated from pendingSummary during highlighting phase", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    // During highlighting: tiles in summary.highlights should have board-grid__cell--scored class
    const tiles = screen.getAllByTestId("board-tile");
    // tile at col=1, row=2 → index 2*10+1=21
    expect(tiles[2 * 10 + 1]).toHaveClass("board-grid__cell--scored");
  });
});

// ─── MatchClient reduced-motion bypass tests (US3) ───────────────────────────

describe("MatchClient reduced-motion bypass (US3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
    // Mock window.matchMedia to simulate prefers-reduced-motion: reduce
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Restore matchMedia to undefined for other tests
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    });
  });

  test("no overlay rendered with reduced motion — animation phase skipped immediately", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    // No overlay — reduced motion skips the animation phase entirely
    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
    // No scored tiles because highlighting phase was bypassed
    const scoredTiles = document.querySelectorAll(".board-grid__cell--scored");
    expect(scoredTiles).toHaveLength(0);
  });

  test("highlight animation is skipped when reduced motion is active", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    // No tiles should have board-grid__cell--scored class (highlighting phase skipped)
    const scoredTiles = document.querySelectorAll(".board-grid__cell--scored");
    expect(scoredTiles).toHaveLength(0);
  });
});

// ─── MatchClient move lock tests (US1) ──────────────────────────────────────

describe("MatchClient move lock (US1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
    mockMatchCallbacks.onState = null;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const col = Number(this.getAttribute("data-col") ?? 0);
        const row = Number(this.getAttribute("data-row") ?? 0);
        const size = 50;
        return {
          top: row * size, left: col * size,
          bottom: row * size + size, right: col * size + size,
          width: size, height: size, x: col * size, y: row * size,
          toJSON: () => ({}),
        };
      },
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "accepted", grid: null }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("T006: board ignores clicks after successful swap submission (moveLocked)", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    const tiles = screen.getAllByTestId("board-tile");
    // Click two tiles to trigger swap
    act(() => { fireEvent.click(tiles[0]); });
    act(() => { fireEvent.click(tiles[1]); });

    // Complete FLIP animation + fetch
    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });

    // Board should now be locked — clicking a tile should NOT select it
    act(() => { fireEvent.click(tiles[20]); });
    expect(tiles[20]).not.toHaveAttribute("aria-selected", "true");
  });

  test("T009: moveLocked resets when currentRound increments via onState", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState({ currentRound: 3 })}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    const tiles = screen.getAllByTestId("board-tile");
    // Swap to lock
    act(() => { fireEvent.click(tiles[0]); });
    act(() => { fireEvent.click(tiles[1]); });
    await act(async () => {
      fireEvent.transitionEnd(tiles[0], { propertyName: "transform" });
      await vi.advanceTimersByTimeAsync(350);
    });

    // Board is locked
    act(() => { fireEvent.click(tiles[20]); });
    expect(tiles[20]).not.toHaveAttribute("aria-selected", "true");

    // Simulate round increment via realtime onState
    act(() => {
      mockMatchCallbacks.onState!(createMatchState({ currentRound: 4 }));
    });

    // Board should be unlocked now — clicking a tile should select it
    act(() => { fireEvent.click(tiles[20]); });
    expect(tiles[20]).toHaveAttribute("aria-selected", "true");
  });
});

// ─── MatchClient round-recap flash tests (US1) ───────────────────────────────

describe("MatchClient round-recap flash (US1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("T014: phases transition idle → round-recap → idle (no overlay)", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => { mockMatchCallbacks.onSummary!(mockRoundSummaryWithMoves); });

    // round-recap phase — scored tile highlights are active
    const tiles = screen.getAllByTestId("board-tile");
    expect(tiles[2 * 10 + 1]).toHaveClass("board-grid__cell--scored");

    // Advance past recap timer (1200ms) → transitions back to idle
    await act(async () => { await vi.advanceTimersByTimeAsync(1201); });

    // No overlay ever appears
    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
    // Animation phase returned to idle — scored tile highlights cleared
    const scoredTilesAfter = document.querySelectorAll(".board-grid__cell--scored");
    expect(scoredTilesAfter).toHaveLength(0);
  });

  test("T015: opponent's swapped tiles get opponent-reveal class during round-recap phase", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => { mockMatchCallbacks.onSummary!(mockRoundSummaryWithMoves); });

    // currentPlayerId is "player-1", so opponent is "player-2" whose move is (7,1)→(7,2)
    const tiles = screen.getAllByTestId("board-tile");
    expect(tiles[1 * 10 + 7]).toHaveClass("board-grid__cell--opponent-reveal");
    expect(tiles[2 * 10 + 7]).toHaveClass("board-grid__cell--opponent-reveal");
  });
});

// ─── Issue #210: opponent's swap reveals immediately mid-round ───────────────

describe("MatchClient opponent move reveal (issue #210)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
    mockMatchCallbacks.onState = null;
    // BoardGrid's FLIP needs measurable bounding rects to apply the animating
    // class and call setCurrentGrid. Provide distinct positions per tile.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const col = Number(this.getAttribute("data-col") ?? 0);
        const row = Number(this.getAttribute("data-row") ?? 0);
        const size = 50;
        return {
          top: row * size,
          left: col * size,
          bottom: row * size + size,
          right: col * size + size,
          width: size,
          height: size,
          x: col * size,
          y: row * size,
          toJSON: () => ({}),
        };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function distinctBoard(): string[][] {
    return Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 10 }, (_, col) =>
        String.fromCharCode("A".charCodeAt(0) + ((row * 10 + col) % 26)),
      ),
    );
  }

  test("opponent pendingMove triggers a mid-round swap on the current player's board", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    const initialState = createMatchState({ board: distinctBoard() });

    await act(async () => {
      render(
        <MatchClient
          initialState={initialState}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    const tiles = screen.getAllByTestId("board-tile");
    const beforeAt2_3 = tiles[3 * 10 + 2].textContent?.charAt(0);
    const beforeAt4_3 = tiles[3 * 10 + 4].textContent?.charAt(0);
    expect(beforeAt2_3).not.toBe(beforeAt4_3);

    // Server pushes a state snapshot in which the OPPONENT (player-2) has a
    // pending swap (2,3) ↔ (4,3). The current player should see the swap
    // animate mid-round.
    await act(async () => {
      mockMatchCallbacks.onState!(
        createMatchState({
          board: distinctBoard(),
          pendingMoves: [
            {
              playerId: "player-2",
              from: { x: 2, y: 3 },
              to: { x: 4, y: 3 },
              submittedAt: "2026-01-01T00:00:01.000Z",
            },
          ],
        }),
      );
    });

    expect(tiles[3 * 10 + 2].textContent?.charAt(0)).toBe(beforeAt4_3);
    expect(tiles[3 * 10 + 4].textContent?.charAt(0)).toBe(beforeAt2_3);
  });

  test("the current player's OWN pendingMove is NOT animated again on their own board", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    const initialState = createMatchState({ board: distinctBoard() });

    await act(async () => {
      render(
        <MatchClient
          initialState={initialState}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    const tiles = screen.getAllByTestId("board-tile");
    const beforeAt2_3 = tiles[3 * 10 + 2].textContent?.charAt(0);
    const beforeAt4_3 = tiles[3 * 10 + 4].textContent?.charAt(0);

    // The current player's own pendingMove already animated locally via
    // handleSwap. Re-broadcasting it via state should NOT trigger another
    // FLIP on their own board.
    await act(async () => {
      mockMatchCallbacks.onState!(
        createMatchState({
          board: distinctBoard(),
          pendingMoves: [
            {
              playerId: "player-1",
              from: { x: 2, y: 3 },
              to: { x: 4, y: 3 },
              submittedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      );
    });

    expect(tiles[3 * 10 + 2].textContent?.charAt(0)).toBe(beforeAt2_3);
    expect(tiles[3 * 10 + 4].textContent?.charAt(0)).toBe(beforeAt4_3);
  });

  test("recap suppresses the opponent-reveal class for moves already animated mid-round", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState({ board: distinctBoard() })}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    // Step 1: opponent submits mid-round; state carries the pendingMove.
    const opponentSubmittedAt = "2026-01-01T00:00:01.000Z";
    await act(async () => {
      mockMatchCallbacks.onState!(
        createMatchState({
          board: distinctBoard(),
          pendingMoves: [
            {
              playerId: "player-2",
              from: { x: 7, y: 1 },
              to: { x: 7, y: 2 },
              submittedAt: opponentSubmittedAt,
            },
          ],
        }),
      );
    });

    // Step 2: round resolves; round-summary references the SAME move.
    const summaryWithMatchingMove: RoundSummary = {
      ...mockRoundSummary,
      moves: [
        {
          playerId: "player-1",
          from: { x: 2, y: 3 },
          to: { x: 4, y: 3 },
          submittedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          playerId: "player-2",
          from: { x: 7, y: 1 },
          to: { x: 7, y: 2 },
          submittedAt: opponentSubmittedAt,
        },
      ],
    };
    await act(async () => {
      mockMatchCallbacks.onSummary!(summaryWithMatchingMove);
    });

    // The opponent-reveal class would have been added by the recap on the
    // opponent's tiles (7,1) and (7,2). Because we already animated that move
    // via the mid-round pendingMove broadcast, the recap must NOT replay it.
    const tiles = screen.getAllByTestId("board-tile");
    expect(tiles[1 * 10 + 7]).not.toHaveClass(
      "board-grid__cell--opponent-reveal",
    );
    expect(tiles[2 * 10 + 7]).not.toHaveClass(
      "board-grid__cell--opponent-reveal",
    );
  });

  test("opponent's revealed swap tiles stay marked as opponent-locked until the round resolves", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState({ board: distinctBoard() })}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    // Opponent submits mid-round.
    await act(async () => {
      mockMatchCallbacks.onState!(
        createMatchState({
          board: distinctBoard(),
          pendingMoves: [
            {
              playerId: "player-2",
              from: { x: 2, y: 3 },
              to: { x: 4, y: 3 },
              submittedAt: "2026-01-01T00:00:01.000Z",
            },
          ],
        }),
      );
    });

    const tiles = screen.getAllByTestId("board-tile");
    expect(tiles[3 * 10 + 2]).toHaveClass("board-grid__cell--opponent-locked");
    expect(tiles[3 * 10 + 4]).toHaveClass("board-grid__cell--opponent-locked");

    // Subsequent broadcasts during the same round must keep the class on.
    await act(async () => {
      mockMatchCallbacks.onState!(
        createMatchState({
          board: distinctBoard(),
          pendingMoves: [
            {
              playerId: "player-2",
              from: { x: 2, y: 3 },
              to: { x: 4, y: 3 },
              submittedAt: "2026-01-01T00:00:01.000Z",
            },
          ],
        }),
      );
    });
    expect(tiles[3 * 10 + 2]).toHaveClass("board-grid__cell--opponent-locked");

    // Round resolves → currentRound increments → tiles release.
    await act(async () => {
      mockMatchCallbacks.onState!(
        createMatchState({
          board: distinctBoard(),
          currentRound: 2,
          pendingMoves: [],
        }),
      );
    });
    expect(tiles[3 * 10 + 2]).not.toHaveClass(
      "board-grid__cell--opponent-locked",
    );
    expect(tiles[3 * 10 + 4]).not.toHaveClass(
      "board-grid__cell--opponent-locked",
    );
  });
});

// ─── DisconnectionModal end-of-match guard (issue #161 follow-up) ──────────

describe("MatchClient disconnection modal guard", () => {
  beforeEach(() => {
    mockMatchCallbacks.onState = null;
  });

  test("does not render the disconnection modal when state is 'completed', even if a snapshot reports an opponent disconnect", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    // Simulate the round-end race: a state snapshot arrives carrying both
    // `state: "completed"` AND a non-null `disconnectedPlayerId`.
    act(() => {
      mockMatchCallbacks.onState!(
        createMatchState({
          state: "completed",
          disconnectedPlayerId: "player-2",
        }),
      );
    });

    expect(
      screen.queryByTestId("disconnection-modal"),
    ).not.toBeInTheDocument();
  });

  test("does not render the disconnection modal when state is 'pending'", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState({ state: "pending" })}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onState!(
        createMatchState({
          state: "pending",
          disconnectedPlayerId: "player-2",
        }),
      );
    });

    expect(
      screen.queryByTestId("disconnection-modal"),
    ).not.toBeInTheDocument();
  });
});

// ─── Round history display names (issue #135) ──────────────────────────────

describe("MatchClient round history panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("renders player display names (not GUIDs) in the round history popup (issue #135)", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    // Populate accumulated round history via a summary broadcast.
    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    // Let the recap animation finish so the History button renders.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    const historyButton = screen.getByTestId("hud-history-button");
    await act(async () => {
      fireEvent.click(historyButton);
    });

    const panel = screen.getByTestId("round-history-panel");
    // Display names should appear; raw player GUIDs should not.
    expect(panel.textContent).toContain("Alice");
    expect(panel.textContent).toContain("Bob");
    expect(panel.textContent).not.toContain("player-1");
    expect(panel.textContent).not.toContain("player-2");
  });
});

// ─── MatchClient dual timeout tests (US4) ──────────────────────────────────

describe("MatchClient dual timeout (US4)", () => {
  test("T030: displays dual-timeout indicator when both timers are at zero", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    const dualTimeoutState = createMatchState({
      timers: {
        playerA: { playerId: "player-1", remainingMs: 0, status: "expired" },
        playerB: { playerId: "player-2", remainingMs: 0, status: "expired" },
      },
    });

    await act(async () => {
      render(
        <MatchClient
          initialState={dualTimeoutState}
          currentPlayerId="player-1"
          matchId="match-test-123"
          playerProfiles={defaultProfiles}
        />,
      );
    });

    expect(screen.getByTestId("dual-timeout-overlay")).toBeInTheDocument();
    expect(screen.getByText(/both players timed out/i)).toBeInTheDocument();
  });
});
