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
    },
  ],
  deltas: { playerA: 35, playerB: 0 },
  totals: { playerA: 65, playerB: 10 },
  highlights: [],
  resolvedAt: new Date().toISOString(),
  moves: [],
};

describe("RoundSummaryPanel enhanced display (US4)", () => {
  it("renders per-word letter breakdown for each scored word", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        playerAId="player-a"
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
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    expect(screen.getByText(/12 \+ 5 bonus/)).toBeInTheDocument();
    expect(screen.getByText(/8 \+ 10 bonus/)).toBeInTheDocument();
  });

  it("shows per-player round delta for current player", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    const deltaEl = screen.getByTestId("round-summary-player-a-delta");
    expect(deltaEl).toHaveTextContent(/\+35/);
  });

  it("shows cumulative total (65) for current player", () => {
    render(
      <RoundSummaryPanel
        summary={summaryWithTwoWords}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    expect(screen.getByText("65")).toBeInTheDocument();
  });

  it("attributes words correctly when opponent's words come first in array", () => {
    const summaryOpponentFirst: RoundSummary = {
      matchId: "match-123",
      roundNumber: 2,
      words: [
        {
          playerId: "player-b",
          word: "tala",
          length: 4,
          lettersPoints: 4,
          bonusPoints: 10,
          totalPoints: 14,
          coordinates: [
            { x: 0, y: 2 },
            { x: 1, y: 2 },
            { x: 2, y: 2 },
            { x: 3, y: 2 },
          ],
        },
      ],
      deltas: { playerA: 0, playerB: 14 },
      totals: { playerA: 10, playerB: 24 },
      highlights: [],
      resolvedAt: new Date().toISOString(),
      moves: [],
    };

    render(
      <RoundSummaryPanel
        summary={summaryOpponentFirst}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    // Current player scored 0 this round
    const yourDelta = screen.getByTestId("round-summary-player-a-delta");
    expect(yourDelta).toHaveTextContent("0 this round");

    // Current player total is 10
    expect(screen.getByText("10")).toBeInTheDocument();

    // No "Your Words" section
    expect(screen.queryByText("Your Words")).not.toBeInTheDocument();

    // Opponent's word is shown under "Opponent's Words"
    expect(screen.getByText("Opponent's Words")).toBeInTheDocument();
    expect(screen.getByText(/TALA/i)).toBeInTheDocument();

    // Opponent delta is +14
    const opponentDelta = screen.getByTestId("round-summary-player-b-delta");
    expect(opponentDelta).toHaveTextContent(/\+14/);
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
        },
      ],
      deltas: { playerA: 35, playerB: 14 },
      totals: { playerA: 65, playerB: 24 },
    };

    render(
      <RoundSummaryPanel
        summary={summaryBothScored}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    const opponentDelta = screen.getByTestId("round-summary-player-b-delta");
    expect(opponentDelta).toHaveTextContent(/\+14/);
    expect(screen.getByText("24")).toBeInTheDocument();
  });
});
