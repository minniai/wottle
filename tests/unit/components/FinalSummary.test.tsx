import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/actions/match/requestRematch", () => ({
  requestRematchAction: vi.fn(),
}));

vi.mock("@/app/actions/match/respondToRematch", () => ({
  acceptRematchAction: vi.fn(),
  declineRematchAction: vi.fn(),
  respondToRematchAction: vi.fn(),
}));

vi.mock("@/app/actions/match/cancelRematch", () => ({
  cancelRematchAction: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabaseClient: () => ({
    channel: () => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
  }),
}));

import { FinalSummary } from "@/components/match/FinalSummary";
import type { FinalSummaryProps } from "@/components/match/FinalSummary";

function makeProps(overrides?: Partial<FinalSummaryProps>): FinalSummaryProps {
  return {
    matchId: "match-1",
    currentPlayerId: "player-a",
    winnerId: "player-a",
    endedReason: "round_limit",
    players: [
      {
        id: "player-a",
        username: "playerA",
        displayName: "Player A",
        score: 100,
        timeRemainingMs: 120_000,
        timeUsedMs: 180_000,
        frozenTileCount: 5,
        topWords: [
          { word: "búr", totalPoints: 20, lettersPoints: 15, bonusPoints: 5 },
          { word: "lag", totalPoints: 15, lettersPoints: 10, bonusPoints: 5 },
        ],
      },
      {
        id: "player-b",
        username: "playerB",
        displayName: "Player B",
        score: 80,
        timeRemainingMs: 60_000,
        timeUsedMs: 240_000,
        frozenTileCount: 3,
        topWords: [
          { word: "fár", totalPoints: 18, lettersPoints: 12, bonusPoints: 6 },
        ],
      },
    ],
    scoreboard: [
      { roundNumber: 1, playerAScore: 50, playerBScore: 30, playerADelta: 50, playerBDelta: 30 },
      { roundNumber: 2, playerAScore: 100, playerBScore: 80, playerADelta: 50, playerBDelta: 50 },
    ],
    wordHistory: [],
    board: null,
    ...overrides,
  };
}

describe("FinalSummary", () => {
  it("T032: renders frozen tile count for each player", () => {
    render(<FinalSummary {...makeProps()} />);
    // Player A has 5 frozen tiles
    expect(screen.getByText(/5 tiles frozen/i)).toBeInTheDocument();
    // Player B has 3 frozen tiles
    expect(screen.getByText(/3 tiles frozen/i)).toBeInTheDocument();
  });

  it("T032: renders top words for each player", () => {
    render(<FinalSummary {...makeProps()} />);
    // Player A's top words
    expect(screen.getByText("búr")).toBeInTheDocument();
    expect(screen.getByText("lag")).toBeInTheDocument();
    // Player B's top words
    expect(screen.getByText("fár")).toBeInTheDocument();
  });

  it("T032: renders winner banner when there is a winner", () => {
    render(<FinalSummary {...makeProps()} />);
    expect(screen.getByText("Winner")).toBeInTheDocument();
    // Winner banner shows the winner's display name; there may be multiple
    // occurrences of "Player A" (winner banner + "Playing as" footer)
    expect(screen.getAllByText("Player A").length).toBeGreaterThanOrEqual(1);
  });

  it("T032: renders ended reason correctly for round_limit", () => {
    render(<FinalSummary {...makeProps()} />);
    expect(screen.getByTestId("final-summary-ended-reason")).toHaveTextContent("10 rounds completed");
  });

  it("T032: renders ended reason correctly for timeout", () => {
    render(<FinalSummary {...makeProps({ endedReason: "timeout" })} />);
    expect(screen.getByTestId("final-summary-ended-reason")).toHaveTextContent("Time expired");
  });

  it("T031: renders series badge when seriesContext has gameNumber > 1", () => {
    render(
      <FinalSummary
        {...makeProps({
          seriesContext: {
            gameNumber: 2,
            currentPlayerWins: 1,
            opponentWins: 0,
            draws: 0,
          },
        })}
      />,
    );
    const badge = screen.getByTestId("series-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Game 2");
    expect(badge).toHaveTextContent("You lead 1-0");
  });

  it("T031: renders series badge with tied score", () => {
    render(
      <FinalSummary
        {...makeProps({
          seriesContext: {
            gameNumber: 3,
            currentPlayerWins: 1,
            opponentWins: 1,
            draws: 0,
          },
        })}
      />,
    );
    const badge = screen.getByTestId("series-badge");
    expect(badge).toHaveTextContent("Game 3");
    expect(badge).toHaveTextContent("Tied 1-1");
  });

  it("T032: does not render series badge when no seriesContext", () => {
    render(<FinalSummary {...makeProps()} />);
    expect(screen.queryByTestId("series-badge")).not.toBeInTheDocument();
  });

  it("T032: does not render series badge when gameNumber is 1", () => {
    render(
      <FinalSummary
        {...makeProps({
          seriesContext: {
            gameNumber: 1,
            currentPlayerWins: 0,
            opponentWins: 0,
            draws: 0,
          },
        })}
      />,
    );
    expect(screen.queryByTestId("series-badge")).not.toBeInTheDocument();
  });
});
