import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameChrome } from "@/components/match/GameChrome";

describe("GameChrome", () => {
  const baseProps = {
    position: "player" as const,
    playerName: "Alice",
    score: 42,
    timerSeconds: 180,
    isPaused: false,
    hasSubmitted: false,
    playerColor: "#3B82F6",
  };

  test("renders player name, timer, and score", () => {
    render(<GameChrome {...baseProps} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
  });

  test("renders move counter for player position", () => {
    render(<GameChrome {...baseProps} moveCounter={5} />);

    expect(screen.getByText("M5")).toBeInTheDocument();
  });

  test("does not render move counter for opponent position", () => {
    render(
      <GameChrome {...baseProps} position="opponent" moveCounter={5} />,
    );

    expect(screen.queryByText("M5")).not.toBeInTheDocument();
  });

  test("maps playerSlot to correct position labels", () => {
    const { rerender } = render(
      <GameChrome {...baseProps} position="opponent" />,
    );
    expect(screen.getByTestId("game-chrome-opponent")).toHaveAttribute(
      "data-position",
      "opponent",
    );

    rerender(<GameChrome {...baseProps} position="player" />);
    expect(screen.getByTestId("game-chrome-player")).toHaveAttribute(
      "data-position",
      "player",
    );
  });
});
