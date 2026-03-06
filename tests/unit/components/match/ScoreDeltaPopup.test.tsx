import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ScoreDeltaPopup } from "@/components/match/ScoreDeltaPopup";

describe("ScoreDeltaPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders letter points in breakdown", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 18, lengthBonus: 0 }}
      />,
    );
    expect(screen.getByTestId("score-delta-popup")).toHaveTextContent(
      "+18 letters",
    );
  });

  test("renders length bonus in breakdown", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 0, lengthBonus: 3 }}
      />,
    );
    expect(screen.getByTestId("score-delta-popup")).toHaveTextContent(
      "+3 length",
    );
  });

  test("renders full breakdown with both values", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 18, lengthBonus: 3 }}
      />,
    );
    const popup = screen.getByTestId("score-delta-popup");
    expect(popup).toHaveTextContent("+18 letters");
    expect(popup).toHaveTextContent("+3 length");
  });

  test("does not render when all values are zero", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 0, lengthBonus: 0 }}
      />,
    );
    expect(screen.queryByTestId("score-delta-popup")).not.toBeInTheDocument();
  });

  test("applies score-delta-popup CSS class for animation", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 5, lengthBonus: 0 }}
      />,
    );
    expect(screen.getByTestId("score-delta-popup")).toHaveClass(
      "score-delta-popup",
    );
  });

  test("has aria-live polite for screen reader announcement", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 5, lengthBonus: 0 }}
      />,
    );
    expect(screen.getByTestId("score-delta-popup")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  test("dismisses after 3 seconds", async () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 5, lengthBonus: 0 }}
      />,
    );
    expect(screen.getByTestId("score-delta-popup")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3001);
    });

    expect(
      screen.queryByTestId("score-delta-popup"),
    ).not.toBeInTheDocument();
  });

  test("omits length line when lengthBonus is 0", () => {
    render(
      <ScoreDeltaPopup
        delta={{ letterPoints: 10, lengthBonus: 0 }}
      />,
    );
    const popup = screen.getByTestId("score-delta-popup");
    expect(popup).not.toHaveTextContent("length");
  });
});
