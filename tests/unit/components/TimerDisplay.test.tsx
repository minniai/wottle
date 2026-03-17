import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TimerDisplay } from "@/components/match/TimerDisplay";

describe("TimerDisplay", () => {
  test("formats time as M:SS", () => {
    render(
      <TimerDisplay
        timerSeconds={185}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByText("3:05")).toBeInTheDocument();
  });

  test("formats zero seconds as 0:00", () => {
    render(
      <TimerDisplay
        timerSeconds={0}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  test("applies timer-display--low class when <= 15s and running", () => {
    render(
      <TimerDisplay
        timerSeconds={10}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).toHaveClass(
      "timer-display--low",
    );
  });

  test("applies timer-display--running class when > 15s and running", () => {
    render(
      <TimerDisplay
        timerSeconds={30}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).toHaveClass(
      "timer-display--running",
    );
  });

  test("applies timer-display--paused class when paused", () => {
    render(
      <TimerDisplay
        timerSeconds={60}
        isPaused={true}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).toHaveClass(
      "timer-display--paused",
    );
  });

  test("does NOT apply low class when paused even if <= 15s", () => {
    render(
      <TimerDisplay
        timerSeconds={10}
        isPaused={true}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).not.toHaveClass(
      "timer-display--low",
    );
  });

  test("applies timer-display--expired class when time is 0", () => {
    render(
      <TimerDisplay
        timerSeconds={0}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).toHaveClass(
      "timer-display--expired",
    );
  });

  test("does not show submitted badge (orange timer is sufficient)", () => {
    render(
      <TimerDisplay
        timerSeconds={120}
        isPaused={true}
        hasSubmitted={true}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.queryByTestId("submitted-badge")).not.toBeInTheDocument();
    expect(screen.queryByText("Move locked")).not.toBeInTheDocument();
  });

  test("shows Expired text when timerSeconds is 0 and not paused", () => {
    render(
      <TimerDisplay
        timerSeconds={0}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  test("uses data-testid timer-display", () => {
    render(
      <TimerDisplay
        timerSeconds={60}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).toBeInTheDocument();
  });
});
