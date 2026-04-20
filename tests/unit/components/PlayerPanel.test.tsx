import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { PlayerPanel } from "@/components/match/PlayerPanel";

const defaultPlayer = {
  displayName: "Alice Wonderland",
  avatarUrl: null as string | null,
  eloRating: 1350,
};

const defaultGameState = {
  score: 45,
  timerSeconds: 180,
  isPaused: false,
  hasSubmitted: false,
  currentRound: 3,
  totalRounds: 10,
  playerColor: "#38BDF8",
};

describe("PlayerPanel full variant", () => {
  test("renders display name", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    expect(screen.getByText("Alice Wonderland")).toBeInTheDocument();
  });

  test("full variant uses paper surface and hair border", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    const panel = screen.getByTestId("player-panel");
    expect(panel.className).toContain("bg-paper");
    expect(panel.className).toContain("border-hair");
    expect(panel.className).not.toContain("bg-gray-900");
    expect(panel.className).not.toContain("border-white/10");
  });

  test("full variant renders 'Round N / M' text (pip bar moved to MatchCenterChrome)", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={{ ...defaultGameState, currentRound: 7, totalRounds: 10 }}
        variant="full"
      />,
    );
    expect(screen.getByText("Round 7 / 10")).toBeInTheDocument();
    expect(screen.queryByLabelText("Round 7 of 10")).not.toBeInTheDocument();
  });

  test("truncates display name longer than 20 characters", () => {
    render(
      <PlayerPanel
        player={{ ...defaultPlayer, displayName: "Alexandrina Victoria Regina" }}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    const nameEl = screen.getByTestId("player-name");
    expect(nameEl).toBeInTheDocument();
    // CSS handles truncation, but the element has the class
    expect(nameEl).toHaveClass("truncate");
  });

  test("renders Elo rating", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    expect(screen.getByTestId("elo-rating")).toBeInTheDocument();
    expect(screen.getByText("1350")).toBeInTheDocument();
  });

  test("renders score with player color", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    const score = screen.getByTestId("player-score");
    expect(score).toBeInTheDocument();
    expect(score.textContent).toContain("45");
  });

  test("renders round indicator", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    expect(screen.getByText("Round 3 / 10")).toBeInTheDocument();
  });

  test("renders timer display", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    expect(screen.getByTestId("timer-display")).toBeInTheDocument();
  });

  test("renders History button when controls provided with history count", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
        controls={{
          roundHistoryCount: 3,
          onHistoryToggle: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
  });

  test("does NOT render History button when roundHistoryCount is 0", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
        controls={{
          roundHistoryCount: 0,
          onHistoryToggle: vi.fn(),
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: /history/i })).not.toBeInTheDocument();
  });

  test("renders Resign button when controls provided", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
        controls={{
          onResign: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /resign/i })).toBeInTheDocument();
  });

  test("does NOT render controls for opponent panel", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    expect(screen.queryByRole("button", { name: /resign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /history/i })).not.toBeInTheDocument();
  });

  test("renders disconnected indicator", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="full"
        isDisconnected={true}
      />,
    );

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  test("renders Unrated when eloRating is 0", () => {
    render(
      <PlayerPanel
        player={{ ...defaultPlayer, eloRating: 0 }}
        gameState={defaultGameState}
        variant="full"
      />,
    );

    expect(screen.getByText("Unrated")).toBeInTheDocument();
  });
});

describe("PlayerPanel compact variant", () => {
  test("renders name, timer, and score in compact layout", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="compact"
      />,
    );

    expect(screen.getByTestId("player-name")).toBeInTheDocument();
    expect(screen.getByTestId("timer-display")).toBeInTheDocument();
    expect(screen.getByTestId("player-score")).toBeInTheDocument();
  });

  test("renders avatar in compact variant", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        variant="compact"
      />,
    );

    expect(screen.getByTestId("player-avatar")).toBeInTheDocument();
  });
});
