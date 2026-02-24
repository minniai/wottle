import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TimerHud } from "@/components/game/TimerHud";

describe("TimerHud", () => {
  const baseProps = {
    timeLeft: 120,
    isPaused: false,
    roundNumber: 3,
  };

  test("renders timer display and round number", () => {
    render(<TimerHud {...baseProps} />);

    expect(screen.getByTestId("timer-display")).toHaveTextContent("2:00");
    expect(screen.getByTestId("round-indicator")).toHaveTextContent("Round 3");
  });

  test("shows waiting indicator when paused", () => {
    render(<TimerHud {...baseProps} isPaused={true} />);

    expect(screen.getByTestId("waiting-indicator")).toBeInTheDocument();
  });

  test("timer text is green when hasSubmitted is false", () => {
    render(<TimerHud {...baseProps} hasSubmitted={false} />);

    const timerEl = screen.getByTestId("timer-display");
    expect(timerEl).toHaveClass("text-emerald-400");
  });

  test("timer text is neutral when hasSubmitted is true", () => {
    render(<TimerHud {...baseProps} hasSubmitted={true} />);

    const timerEl = screen.getByTestId("timer-display");
    expect(timerEl).toHaveClass("text-slate-400");
  });
});
