import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoundSummaryPanel } from "@/components/match/RoundSummaryPanel";
import type { RoundSummary } from "@/lib/types/match";

const summaryWithTwoWords: RoundSummary = {
  matchId: "match-123",
  roundNumber: 2,
  words: [
    {
      playerId: "player-a",
      word: "búr",
      length: 3,
      lettersPoints: 12,
      bonusPoints: 5,
      totalPoints: 17,
      coordinates: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      isDuplicate: false,
    },
    {
      playerId: "player-a",
      word: "hest",
      length: 4,
      lettersPoints: 8,
      bonusPoints: 10,
      totalPoints: 18,
      coordinates: [
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
        { x: 6, y: 1 },
      ],
      isDuplicate: false,
    },
  ],
  deltas: { playerA: 39, playerB: 0 },
  totals: { playerA: 65, playerB: 10 },
  comboBonus: { playerA: 2, playerB: 0 },
  highlights: [],
  resolvedAt: new Date().toISOString(),
};

describe("RoundSummaryPanel enhanced display (US4)", () => {
  it("renders per-word letter breakdown for each scored word", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        autoDismissMs={0}
      />,
    );

    expect(screen.getByText(/BÚR/i)).toBeInTheDocument();
    expect(screen.getByText(/12 \+ 5 bonus/)).toBeInTheDocument();
    expect(screen.getByText(/\+17/)).toBeInTheDocument();

    expect(screen.getByText(/HEST/i)).toBeInTheDocument();
    expect(screen.getByText(/8 \+ 10 bonus/)).toBeInTheDocument();
    expect(screen.getByText(/\+18/)).toBeInTheDocument();
  });

  it("shows length bonus per word", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        autoDismissMs={0}
      />,
    );

    expect(screen.getByText(/12 \+ 5 bonus/)).toBeInTheDocument();
    expect(screen.getByText(/8 \+ 10 bonus/)).toBeInTheDocument();
  });

  it("displays multi-word combo bonus line when player has multiple words", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        autoDismissMs={0}
      />,
    );

    expect(screen.getByText(/combo/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });

  it("shows per-player round delta (+25) for current player", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        autoDismissMs={0}
      />,
    );

    const deltaEl = screen.getByTestId("round-summary-player-a-delta");
    expect(deltaEl).toHaveTextContent(/\+39/);
  });

  it("shows cumulative total (65) for current player", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        autoDismissMs={0}
      />,
    );

    expect(screen.getByText("65")).toBeInTheDocument();
  });

  it("shows opponent delta and total when opponent scored", () => {
    const summaryBothScored: RoundSummary = {
      ...summaryWithTwoWords,
      words: [
        ...summaryWithTwoWords.words,
        {
          playerId: "player-b",
          word: "tala",
          length: 4,
          lettersPoints: 4,
          bonusPoints: 10,
          totalPoints: 14,
          coordinates: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
          isDuplicate: false,
        },
      ],
      deltas: { playerA: 39, playerB: 14 },
      totals: { playerA: 65, playerB: 24 },
      comboBonus: { playerA: 2, playerB: 0 },
    };

    render(
      <RoundSummaryPanel
        summary={summaryBothScored}
        currentPlayerId="player-a"
        autoDismissMs={0}
      />,
    );

    const opponentDelta = screen.getByTestId("round-summary-player-b-delta");
    expect(opponentDelta).toHaveTextContent(/\+14/);
    expect(screen.getByText("24")).toBeInTheDocument();
  });
});
