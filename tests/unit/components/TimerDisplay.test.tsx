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

  test("applies timer-display--urgent class when < 30s and running", () => {
    const { container } = render(
      <TimerDisplay
        timerSeconds={25}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(container.firstChild).toHaveClass("timer-display--urgent");
  });

  test("does NOT apply urgent class when >= 30s", () => {
    const { container } = render(
      <TimerDisplay
        timerSeconds={30}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(container.firstChild).not.toHaveClass("timer-display--urgent");
  });

  test("does NOT apply urgent class when paused even if < 30s", () => {
    const { container } = render(
      <TimerDisplay
        timerSeconds={15}
        isPaused={true}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(container.firstChild).not.toHaveClass("timer-display--urgent");
  });

  test("shows Submitted badge when hasSubmitted is true", () => {
    render(
      <TimerDisplay
        timerSeconds={120}
        isPaused={true}
        hasSubmitted={true}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByText("Submitted")).toBeInTheDocument();
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
