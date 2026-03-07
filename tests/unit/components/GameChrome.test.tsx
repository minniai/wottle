import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameChrome } from "@/components/match/GameChrome";
import type { ScoreDelta } from "@/components/match/ScoreDeltaPopup";

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

  test("renders round indicator for player position", () => {
    render(<GameChrome {...baseProps} moveCounter={5} />);
    expect(screen.getByTestId("round-indicator")).toHaveTextContent("R5");
  });

  test("renders round indicator for opponent position", () => {
    render(
      <GameChrome {...baseProps} position="opponent" moveCounter={5} />,
    );
    expect(screen.getByTestId("round-indicator")).toHaveTextContent("R5");
  });

  test("chrome bar has green background when running", () => {
    render(<GameChrome {...baseProps} hasSubmitted={false} />);

    const chrome = screen.getByTestId("game-chrome-player");
    expect(chrome).toHaveClass("bg-emerald-600");
    expect(chrome).toHaveAttribute("data-timer-status", "running");
  });

  test("chrome bar has amber background when paused", () => {
    render(<GameChrome {...baseProps} hasSubmitted={true} />);

    const chrome = screen.getByTestId("game-chrome-player");
    expect(chrome).toHaveClass("bg-amber-500");
    expect(chrome).toHaveAttribute("data-timer-status", "paused");
  });

  test("score displays with playerColor accent", () => {
    render(<GameChrome {...baseProps} score={99} playerColor="#EF4444" />);

    const scoreEl = screen.getByText("99");
    expect(scoreEl).toHaveStyle({ color: "#EF4444" });
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

  describe("chrome bar background colors by timer status", () => {
    test("green background when running (not submitted)", () => {
      render(
        <GameChrome
          {...baseProps}
          hasSubmitted={false}
          timerSeconds={180}
        />,
      );
      const chrome = screen.getByTestId("game-chrome-player");
      expect(chrome).toHaveClass("bg-emerald-600");
      expect(chrome).toHaveAttribute("data-timer-status", "running");
    });

    test("amber background when paused (hasSubmitted=true)", () => {
      render(
        <GameChrome
          {...baseProps}
          hasSubmitted={true}
          timerSeconds={180}
        />,
      );
      const chrome = screen.getByTestId("game-chrome-player");
      expect(chrome).toHaveClass("bg-amber-500");
      expect(chrome).toHaveAttribute("data-timer-status", "paused");
    });

    test("red background when timer expired (timerSeconds=0)", () => {
      render(
        <GameChrome
          {...baseProps}
          hasSubmitted={false}
          timerSeconds={0}
        />,
      );
      const chrome = screen.getByTestId("game-chrome-player");
      expect(chrome).toHaveClass("bg-red-600");
      expect(chrome).toHaveAttribute("data-timer-status", "expired");
    });
  });

  describe("ScoreDeltaPopup integration", () => {
    const delta: ScoreDelta = { letterPoints: 18, lengthBonus: 3 };

    test("renders popup when scoreDelta is provided", () => {
      render(
        <GameChrome {...baseProps} scoreDelta={delta} scoreDeltaRound={1} />,
      );
      expect(screen.getByTestId("score-delta-popup")).toBeInTheDocument();
    });

    test("does not render popup when scoreDelta is null", () => {
      render(<GameChrome {...baseProps} scoreDelta={null} />);
      expect(
        screen.queryByTestId("score-delta-popup"),
      ).not.toBeInTheDocument();
    });

    test("does not render popup when scoreDelta is not provided", () => {
      render(<GameChrome {...baseProps} />);
      expect(
        screen.queryByTestId("score-delta-popup"),
      ).not.toBeInTheDocument();
    });

    test("score container is relatively positioned for popup overlay", () => {
      render(
        <GameChrome {...baseProps} scoreDelta={delta} scoreDeltaRound={1} />,
      );
      const popup = screen.getByTestId("score-delta-popup");
      // Popup should be inside a relative container near the score
      const container = popup.closest("[data-testid='score-container']");
      expect(container).toBeInTheDocument();
    });
  });
});
