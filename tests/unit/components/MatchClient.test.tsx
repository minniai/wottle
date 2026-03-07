import { render, screen, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { deriveScoreDelta } from "@/components/match/deriveScoreDelta";
import { deriveHighlightPlayerColors } from "@/components/match/deriveHighlightPlayerColors";
import type { MatchState, RoundSummary } from "@/lib/types/match";
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

// Mock Supabase browser client
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabaseClient: () => ({}),
}));

// Mock realtime channel — captures onSummary for phase machine tests
vi.mock("@/lib/realtime/matchChannel", () => ({
  subscribeToMatchChannel: (
    _client: unknown,
    _matchId: string,
    callbacks: { onSummary: (summary: RoundSummary) => void; onState?: (state: MatchState) => void },
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
    { playerId: "player-1", from: { x: 2, y: 3 }, to: { x: 4, y: 3 } },
    { playerId: "player-2", from: { x: 7, y: 1 }, to: { x: 7, y: 2 } },
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
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
  });

  test("RoundSummaryPanel IS rendered after 800ms timer fires", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(801);
    });

    expect(screen.getByTestId("round-summary-panel")).toBeInTheDocument();
  });

  test("scoredTileHighlights passed to BoardGrid is populated from pendingSummary during highlighting phase", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
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

  test("RoundSummaryPanel renders immediately when prefers-reduced-motion is active (no 800ms wait)", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    // With reduced motion: panel should be visible immediately (no 800ms wait needed)
    expect(screen.getByTestId("round-summary-panel")).toBeInTheDocument();
  });

  test("animationPhase transitions directly to showing-summary without highlighting when reduced motion is active", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
        />,
      );
    });

    act(() => {
      mockMatchCallbacks.onSummary!(mockRoundSummary);
    });

    // Panel is visible without advancing timers — confirms no 800ms gate
    expect(screen.getByTestId("round-summary-panel")).toBeInTheDocument();

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

// ─── MatchClient opponent reveal tests (US2) ────────────────────────────────

describe("MatchClient opponent reveal (US2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchCallbacks.onSummary = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("T014: phases transition idle → revealing-opponent-move → highlighting → showing-summary", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
        />,
      );
    });

    act(() => { mockMatchCallbacks.onSummary!(mockRoundSummaryWithMoves); });

    // Phase 1: revealing-opponent-move — no scored highlights, no summary panel
    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
    const scoredDuringReveal = document.querySelectorAll(".board-grid__cell--scored");
    expect(scoredDuringReveal).toHaveLength(0);

    // Advance past reveal timer (1000ms) → transitions to "highlighting"
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });

    // Phase 2: highlighting — scored highlights ARE active, no summary panel
    expect(screen.queryByTestId("round-summary-panel")).not.toBeInTheDocument();
    const scoredDuringHighlight = document.querySelectorAll(".board-grid__cell--scored");
    expect(scoredDuringHighlight.length).toBeGreaterThan(0);

    // Advance past highlight timer (800ms) → transitions to "showing-summary"
    await act(async () => { await vi.advanceTimersByTimeAsync(801); });

    // Phase 3: showing-summary — summary panel IS shown
    expect(screen.getByTestId("round-summary-panel")).toBeInTheDocument();
  });

  test("T015: opponent's swapped tiles get opponent-reveal class during reveal phase", async () => {
    const { MatchClient } = await import("@/components/match/MatchClient");

    await act(async () => {
      render(
        <MatchClient
          initialState={createMatchState()}
          currentPlayerId="player-1"
          matchId="match-test-123"
        />,
      );
    });

    act(() => { mockMatchCallbacks.onSummary!(mockRoundSummaryWithMoves); });

    // Opponent is player-2, their move is (7,1)→(7,2)
    const tiles = screen.getAllByTestId("board-tile");
    expect(tiles[1 * 10 + 7]).toHaveClass("board-grid__cell--opponent-reveal");
    expect(tiles[2 * 10 + 7]).toHaveClass("board-grid__cell--opponent-reveal");
  });
});
