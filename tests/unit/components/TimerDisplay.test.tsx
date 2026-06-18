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

  test("applies critical (blinking) tone when <= 15s and running", () => {
    render(
      <TimerDisplay
        timerSeconds={10}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    const el = screen.getByTestId("timer-display");
    expect(el).toHaveClass("timer-display--critical");
    expect(el).toHaveClass("timer-display--blink");
  });

  test("applies warning tone (no blink) when <= 30s and > 15s", () => {
    render(
      <TimerDisplay
        timerSeconds={25}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    const el = screen.getByTestId("timer-display");
    expect(el).toHaveClass("timer-display--warning");
    expect(el).not.toHaveClass("timer-display--blink");
  });

  test("applies active tone when > 30s and running", () => {
    render(
      <TimerDisplay
        timerSeconds={45}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.getByTestId("timer-display")).toHaveClass(
      "timer-display--active",
    );
  });

  test("exposes the urgency ratio as a --clock-urgency custom property", () => {
    render(
      <TimerDisplay
        timerSeconds={15}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(
      screen
        .getByTestId("timer-display")
        .style.getPropertyValue("--clock-urgency"),
    ).toBe("0.5");
  });

  test("applies waiting tone when paused", () => {
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
      "timer-display--waiting",
    );
  });

  test("does NOT blink when paused even if <= 15s", () => {
    render(
      <TimerDisplay
        timerSeconds={10}
        isPaused={true}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    const el = screen.getByTestId("timer-display");
    expect(el).not.toHaveClass("timer-display--blink");
    expect(el).not.toHaveClass("timer-display--critical");
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

  test("does not show Expired text (red 0:00 is sufficient)", () => {
    render(
      <TimerDisplay
        timerSeconds={0}
        isPaused={false}
        hasSubmitted={false}
        playerColor="#38BDF8"
        size="lg"
      />,
    );

    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();
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
