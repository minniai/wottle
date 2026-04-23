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

  test("bar heights encode cumulative score and grow monotonically left-to-right", () => {
    render(<RoundByRoundChart rounds={sampleRounds} maxHeightPx={100} />);
    const bars = screen.getAllByTestId("round-chart-bar--a");
    const heights = bars.map((b) => Number(b.style.height.replace("px", "")));
    // Scale = max cumulative score across both players = 50 (player B, round 3).
    // Player A cumulative scores: 22, 31, 43 → heights 44, 62, 86 at maxHeightPx=100.
    expect(heights[0]).toBe(44);
    expect(heights[1]).toBe(62);
    expect(heights[2]).toBe(86);
    expect(heights[0]).toBeLessThan(heights[1]);
    expect(heights[1]).toBeLessThan(heights[2]);
  });

  test("stacks a delta overlay on top of each bar sized by the round delta", () => {
    render(<RoundByRoundChart rounds={sampleRounds} maxHeightPx={100} />);
    const deltaOverlays = screen.getAllByTestId("round-chart-bar--a-delta");
    const heights = deltaOverlays.map((d) => Number(d.style.height.replace("px", "")));
    // Scale = 50. Deltas 22, 9, 12 → 44, 18, 24.
    expect(heights).toEqual([44, 18, 24]);
  });

  test("records delta and cumulative score via data attributes for inspection", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const firstA = screen.getAllByTestId("round-chart-bar--a")[0];
    const firstB = screen.getAllByTestId("round-chart-bar--b")[0];
    expect(firstA.dataset.delta).toBe("22");
    expect(firstA.dataset.score).toBe("22");
    expect(firstB.dataset.delta).toBe("15");
    expect(firstB.dataset.score).toBe("15");
  });

  test("zero-delta round still shows the cumulative base bar without a delta overlay", () => {
    render(
      <RoundByRoundChart
        rounds={[
          { roundNumber: 1, playerAScore: 22, playerBScore: 15, playerADelta: 22, playerBDelta: 15 },
          { roundNumber: 2, playerAScore: 22, playerBScore: 33, playerADelta: 0, playerBDelta: 18 },
        ]}
        maxHeightPx={100}
      />,
    );
    const secondA = screen.getAllByTestId("round-chart-bar--a")[1];
    // Cumulative still 22 → scale 33 → height 67.
    expect(Number(secondA.style.height.replace("px", ""))).toBe(67);
    const deltaOverlays = screen.queryAllByTestId("round-chart-bar--a-delta");
    // Only round 1 has a delta overlay for player A; round 2 has playerADelta = 0.
    expect(deltaOverlays).toHaveLength(1);
  });

  test("renders a zero baseline at maxHeightPx from the top of the bar area", () => {
    render(<RoundByRoundChart rounds={sampleRounds} maxHeightPx={140} />);
    const zero = screen.getByTestId("round-chart-zero-line");
    expect(zero.style.top).toBe("140px");
  });

  test("renders the delta as a label inside the shaded top overlay", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const firstADelta = screen.getAllByTestId("round-chart-bar--a-delta")[0];
    const firstBDelta = screen.getAllByTestId("round-chart-bar--b-delta")[0];
    expect(within(firstADelta).getByText("22")).toBeInTheDocument();
    expect(within(firstBDelta).getByText("15")).toBeInTheDocument();
  });

  test("omits the delta overlay when the delta is zero", () => {
    render(
      <RoundByRoundChart
        rounds={[
          { roundNumber: 1, playerAScore: 10, playerBScore: 10, playerADelta: 0, playerBDelta: 10 },
        ]}
      />,
    );
    expect(screen.queryByTestId("round-chart-bar--a-delta")).not.toBeInTheDocument();
    expect(screen.getByTestId("round-chart-bar--b-delta")).toBeInTheDocument();
  });
});
