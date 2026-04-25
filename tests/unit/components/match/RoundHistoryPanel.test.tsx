import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { RoundHistoryPanel } from "@/components/match/RoundHistoryPanel";
import type { RoundHistoryEntry } from "@/components/match/deriveRoundHistory";
import type { WordHistoryRow } from "@/components/match/FinalSummary";

function makeWord(overrides: Partial<WordHistoryRow> = {}): WordHistoryRow {
  return {
    roundNumber: 1,
    playerId: "player-a",
    word: "búr",
    totalPoints: 20,
    lettersPoints: 15,
    bonusPoints: 5,
    coordinates: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    ...overrides,
  };
}

function makeRound(roundNumber: number, words: WordHistoryRow[]): RoundHistoryEntry {
  const aWords = words.filter((w) => w.playerId === "player-a");
  const bWords = words.filter((w) => w.playerId === "player-b");
  return {
    roundNumber,
    playerA: {
      playerId: "player-a",
      username: "Ásta",
      delta: aWords.reduce((sum, w) => sum + w.totalPoints, 0),
      cumulative: aWords.reduce((sum, w) => sum + w.totalPoints, 0),
      words: aWords,
    },
    playerB: {
      playerId: "player-b",
      username: "Sigríður",
      delta: bWords.reduce((sum, w) => sum + w.totalPoints, 0),
      cumulative: bWords.reduce((sum, w) => sum + w.totalPoints, 0),
      words: bWords,
    },
  };
}

const sampleRounds: RoundHistoryEntry[] = [
  makeRound(1, [
    makeWord({ roundNumber: 1, playerId: "player-a", word: "búr" }),
    makeWord({
      roundNumber: 1,
      playerId: "player-b",
      word: "lag",
      coordinates: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 5, y: 7 },
      ],
    }),
  ]),
  makeRound(2, [
    makeWord({
      roundNumber: 2,
      playerId: "player-a",
      word: "fár",
      coordinates: [
        { x: 9, y: 9 },
        { x: 9, y: 8 },
        { x: 9, y: 7 },
      ],
    }),
  ]),
];

describe("RoundHistoryPanel", () => {
  test("renders rounds collapsed by default", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
      />,
    );

    const triggers = screen.getAllByRole("button", { name: /Round \d+/i });
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }

    // Word rows should not be visible while every round is collapsed.
    expect(screen.queryByText("búr")).toBeNull();
    expect(screen.queryByText("lag")).toBeNull();
    expect(screen.queryByText("fár")).toBeNull();
  });

  test("toggle-all button expands every round, then collapses again", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
      />,
    );

    const toggleAll = screen.getByTestId("round-history-toggle-all");
    expect(toggleAll).toHaveTextContent(/expand all/i);

    fireEvent.click(toggleAll);

    const triggersExpanded = screen.getAllByRole("button", {
      name: /Round \d+/i,
    });
    for (const trigger of triggersExpanded) {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    }
    expect(screen.getByText("búr")).toBeInTheDocument();
    expect(screen.getByText("fár")).toBeInTheDocument();
    expect(toggleAll).toHaveTextContent(/collapse all/i);

    fireEvent.click(toggleAll);

    const triggersCollapsed = screen.getAllByRole("button", {
      name: /Round \d+/i,
    });
    for (const trigger of triggersCollapsed) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }
    expect(screen.queryByText("búr")).toBeNull();
    expect(toggleAll).toHaveTextContent(/expand all/i);
  });

  test("hovering a round row highlights every scored word from that round", () => {
    const onHighlight = vi.fn();
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
        onHighlight={onHighlight}
      />,
    );

    const round1 = screen.getByTestId("round-row-1");
    fireEvent.mouseEnter(round1);

    const lastCall = onHighlight.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const highlightedWords = lastCall![0] as WordHistoryRow[];
    expect(highlightedWords).toHaveLength(2);
    const wordsByText = highlightedWords.map((w) => w.word).sort();
    expect(wordsByText).toEqual(["búr", "lag"]);

    fireEvent.mouseLeave(round1);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });

  test("hovering an individual word still highlights only that word", () => {
    const onHighlight = vi.fn();
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
        onHighlight={onHighlight}
      />,
    );

    fireEvent.click(screen.getByTestId("round-history-toggle-all"));

    const wordRow = screen.getByText("búr").closest("li");
    expect(wordRow).not.toBeNull();

    onHighlight.mockClear();
    fireEvent.mouseEnter(wordRow!);

    const lastCall = onHighlight.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const highlightedWords = lastCall![0] as WordHistoryRow[];
    expect(highlightedWords).toHaveLength(1);
    expect(highlightedWords[0].word).toBe("búr");
  });

  test("uses player design tokens, not legacy blue/red, for player labels", () => {
    const { container } = render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
      />,
    );

    expect(container.querySelector(".text-blue-400")).toBeNull();
    expect(container.querySelector(".text-red-400")).toBeNull();
    // bonus points used emerald-400, swing/top-word callouts used amber/emerald-500
    expect(container.querySelector(".text-emerald-400")).toBeNull();
    expect(container.querySelector(".bg-amber-500\\/5")).toBeNull();
    expect(container.querySelector(".bg-emerald-500\\/5")).toBeNull();
  });
});

describe("RoundHistoryPanel — empty", () => {
  test("renders empty state when there are no rounds", () => {
    render(
      <RoundHistoryPanel
        rounds={[]}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
      />,
    );
    expect(screen.getByTestId("round-history-empty")).toBeInTheDocument();
  });
});

describe("RoundHistoryPanel — Warm Editorial callouts (issue #209 follow-up)", () => {
  test("biggest swing favoring player A is tinted in player A's color, not green/red", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
        playerASlotId="player-a"
        biggestSwing={{
          roundNumber: 2,
          swingAmount: 18,
          favoredPlayerId: "player-a",
        }}
      />,
    );

    const callout = screen.getByTestId("callout-biggest-swing");
    // Player A → p1 family (warm ochre)
    expect(callout.className).toMatch(/(?:^|\s)(?:border-|bg-|text-)p1(?:-deep)?\b/);
    // No legacy semantic colors
    expect(callout.className).not.toMatch(/\bwarn\b/);
    expect(callout.className).not.toMatch(/\bgood\b/);
    expect(callout.className).not.toMatch(/(emerald|rose|amber|red|green)-\d/);
  });

  test("biggest swing favoring player B is tinted in player B's color", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
        playerASlotId="player-a"
        biggestSwing={{
          roundNumber: 1,
          swingAmount: 12,
          favoredPlayerId: "player-b",
        }}
      />,
    );

    const callout = screen.getByTestId("callout-biggest-swing");
    expect(callout.className).toMatch(/(?:^|\s)(?:border-|bg-|text-)p2(?:-deep)?\b/);
  });

  test("top word scored by player A uses player A color tint", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
        playerASlotId="player-a"
        highestWord={{
          word: "búr",
          totalPoints: 20,
          playerId: "player-a",
          username: "Ásta",
          roundNumber: 1,
        }}
      />,
    );

    const callout = screen.getByTestId("callout-highest-word");
    expect(callout.className).toMatch(/(?:^|\s)(?:border-|bg-|text-)p1(?:-deep)?\b/);
    expect(callout.className).not.toMatch(/\bgood\b/);
    expect(callout.className).not.toMatch(/(emerald|green|amber)-\d/);
  });

  test("top word scored by player B uses player B color tint", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
        playerASlotId="player-a"
        highestWord={{
          word: "lag",
          totalPoints: 24,
          playerId: "player-b",
          username: "Sigríður",
          roundNumber: 1,
        }}
      />,
    );

    const callout = screen.getByTestId("callout-highest-word");
    expect(callout.className).toMatch(/(?:^|\s)(?:border-|bg-|text-)p2(?:-deep)?\b/);
  });
});

describe("RoundHistoryPanel — scrollable rounds list (issue #209 follow-up)", () => {
  test("rounds list is constrained with max-height + overflow so expanding doesn't grow the page", () => {
    render(
      <RoundHistoryPanel
        rounds={sampleRounds}
        playerAUsername="Ásta"
        playerBUsername="Sigríður"
      />,
    );

    const list = screen.getByTestId("round-history-list");
    expect(list.className).toMatch(/\bmax-h-/);
    expect(list.className).toMatch(/\boverflow-y-auto\b/);
  });
});

