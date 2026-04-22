import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

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

describe("PlayerPanel", () => {
  test("renders name, timer, and score in compact layout", () => {
    render(<PlayerPanel player={defaultPlayer} gameState={defaultGameState} />);

    expect(screen.getByTestId("player-name")).toBeInTheDocument();
    expect(screen.getByTestId("timer-display")).toBeInTheDocument();
    expect(screen.getByTestId("player-score")).toBeInTheDocument();
  });

  test("renders avatar", () => {
    render(<PlayerPanel player={defaultPlayer} gameState={defaultGameState} />);

    expect(screen.getByTestId("player-avatar")).toBeInTheDocument();
  });

  test("renders round indicator with R{n} format", () => {
    render(<PlayerPanel player={defaultPlayer} gameState={defaultGameState} />);

    expect(screen.getByTestId("round-indicator")).toHaveTextContent(/R3/);
  });

  test("renders disconnected badge when isDisconnected=true", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={defaultGameState}
        isDisconnected
      />,
    );

    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });

  test("uses playerColor for the score", () => {
    render(
      <PlayerPanel
        player={defaultPlayer}
        gameState={{ ...defaultGameState, playerColor: "#ff00aa" }}
      />,
    );

    expect(screen.getByTestId("player-score")).toHaveStyle({
      color: "#ff00aa",
    });
  });
});
