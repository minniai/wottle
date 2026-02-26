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

  test("renders round indicator for opponent position", () => {
    render(
      <GameChrome {...baseProps} position="opponent" moveCounter={3} />,
    );

    const roundEl = screen.getByTestId("round-indicator");
    expect(roundEl).toHaveTextContent("Round 3");
  });

  test("does not render round indicator for player position", () => {
    render(<GameChrome {...baseProps} moveCounter={3} />);

    expect(screen.queryByTestId("round-indicator")).not.toBeInTheDocument();
  });

  test("timer text is green when hasSubmitted is false", () => {
    render(<GameChrome {...baseProps} hasSubmitted={false} />);

    const timerEl = screen.getByText("3:00");
    expect(timerEl).toHaveClass("text-emerald-400");
    expect(timerEl).not.toHaveClass("text-slate-400");
  });

  test("timer text is neutral when hasSubmitted is true", () => {
    render(<GameChrome {...baseProps} hasSubmitted={true} />);

    const timerEl = screen.getByText("3:00");
    expect(timerEl).toHaveClass("text-slate-400");
    expect(timerEl).not.toHaveClass("text-emerald-400");
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

  describe("ScoreDeltaPopup integration", () => {
    const delta: ScoreDelta = { letterPoints: 18, lengthBonus: 3, combo: 2 };

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
