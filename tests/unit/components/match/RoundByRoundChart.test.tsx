import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RoundByRoundChart } from "@/components/match/RoundByRoundChart";
import type { ScoreboardRow } from "@/components/match/FinalSummary";

const sampleRounds: ScoreboardRow[] = [
  { roundNumber: 1, playerAScore: 22, playerBScore: 15, playerADelta: 22, playerBDelta: 15 },
  { roundNumber: 2, playerAScore: 31, playerBScore: 43, playerADelta: 9, playerBDelta: 28 },
  { roundNumber: 3, playerAScore: 43, playerBScore: 50, playerADelta: 12, playerBDelta: 7 },
];

describe("RoundByRoundChart", () => {
  test("renders one column per round", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    expect(screen.getAllByTestId("round-chart-col")).toHaveLength(3);
  });

  test("renders a mono R{n} label under each column", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const cols = screen.getAllByTestId("round-chart-col");
    expect(within(cols[0]).getByText("R1")).toBeInTheDocument();
    expect(within(cols[1]).getByText("R2")).toBeInTheDocument();
    expect(within(cols[2]).getByText("R3")).toBeInTheDocument();
  });

  test("scales bar heights relative to maxAbsDelta", () => {
    render(<RoundByRoundChart rounds={sampleRounds} maxHeightPx={100} />);
    const bar = screen.getAllByTestId("round-chart-bar--a")[0];
    expect(Number(bar.style.height.replace("px", ""))).toBeGreaterThan(75);
    expect(Number(bar.style.height.replace("px", ""))).toBeLessThan(82);
  });

  test("records deltas via data attributes for inspection", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const firstA = screen.getAllByTestId("round-chart-bar--a")[0];
    const firstB = screen.getAllByTestId("round-chart-bar--b")[0];
    expect(firstA.dataset.delta).toBe("22");
    expect(firstB.dataset.delta).toBe("15");
  });

  test("zero-delta round renders with height 0", () => {
    render(
      <RoundByRoundChart
        rounds={[
          { roundNumber: 1, playerAScore: 0, playerBScore: 10, playerADelta: 0, playerBDelta: 10 },
        ]}
      />,
    );
    const a = screen.getAllByTestId("round-chart-bar--a")[0];
    expect(a.style.height).toBe("0px");
  });

  test("renders a zero baseline at maxHeightPx from the top of the bar area", () => {
    render(<RoundByRoundChart rounds={sampleRounds} maxHeightPx={140} />);
    const zero = screen.getByTestId("round-chart-zero-line");
    expect(zero.style.top).toBe("140px");
  });

  test("renders the delta as a label inside each non-zero bar", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const firstA = screen.getAllByTestId("round-chart-bar--a")[0];
    const firstB = screen.getAllByTestId("round-chart-bar--b")[0];
    expect(within(firstA).getByText("22")).toBeInTheDocument();
    expect(within(firstB).getByText("15")).toBeInTheDocument();
  });

  test("omits the delta label when the delta is zero", () => {
    render(
      <RoundByRoundChart
        rounds={[
          { roundNumber: 1, playerAScore: 0, playerBScore: 10, playerADelta: 0, playerBDelta: 10 },
        ]}
      />,
    );
    const barA = screen.getAllByTestId("round-chart-bar--a")[0];
    expect(within(barA).queryByText("0")).not.toBeInTheDocument();
  });
});
