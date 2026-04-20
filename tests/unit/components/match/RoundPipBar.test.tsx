import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RoundPipBar } from "@/components/match/RoundPipBar";

describe("RoundPipBar", () => {
  test("renders a pip per total rounds", () => {
    render(<RoundPipBar current={1} total={10} />);
    const bar = screen.getByTestId("round-pip-bar");
    expect(within(bar).getAllByTestId("round-pip")).toHaveLength(10);
  });

  test("aria-label describes current/total", () => {
    render(<RoundPipBar current={7} total={10} />);
    expect(
      screen.getByLabelText("Round 7 of 10"),
    ).toBeInTheDocument();
  });

  test("pips before `current` have the done state", () => {
    render(<RoundPipBar current={3} total={10} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips[0].dataset.state).toBe("done");
    expect(pips[1].dataset.state).toBe("done");
  });

  test("pip at index `current - 1` is the current pip", () => {
    render(<RoundPipBar current={3} total={10} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips[2].dataset.state).toBe("current");
  });

  test("pips after `current` have the future state", () => {
    render(<RoundPipBar current={3} total={10} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips[3].dataset.state).toBe("future");
    expect(pips[9].dataset.state).toBe("future");
  });

  test("accepts total > 10", () => {
    render(<RoundPipBar current={12} total={15} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips).toHaveLength(15);
    expect(pips[11].dataset.state).toBe("current");
  });
});
