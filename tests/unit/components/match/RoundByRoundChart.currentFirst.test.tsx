import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RoundByRoundChart } from "@/components/match/RoundByRoundChart";
import type { ScoreboardRow } from "@/components/match/FinalSummary";

const rounds: ScoreboardRow[] = [
  { roundNumber: 1, playerAScore: 22, playerBScore: 15, playerADelta: 22, playerBDelta: 15 },
];

function barsInFirstColumn() {
  const col = screen.getAllByTestId("round-chart-col")[0];
  return {
    a: within(col).getByTestId("round-chart-bar--a"),
    b: within(col).getByTestId("round-chart-bar--b"),
  };
}

describe("RoundByRoundChart current-player ordering", () => {
  test("keeps player A's bar on top by default (spectator / current is player A)", () => {
    render(<RoundByRoundChart rounds={rounds} />);
    const { a, b } = barsInFirstColumn();
    // a precedes b in document order → a is the top bar
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("puts the current player's bar (player B) on top when currentIsPlayerA is false", () => {
    render(<RoundByRoundChart rounds={rounds} currentIsPlayerA={false} />);
    const { a, b } = barsInFirstColumn();
    // b precedes a in document order → b (current) is the top bar
    expect(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("keeps each player's delta tied to their own bar regardless of order", () => {
    render(<RoundByRoundChart rounds={rounds} currentIsPlayerA={false} />);
    const { a, b } = barsInFirstColumn();
    expect(a.dataset.delta).toBe("22");
    expect(b.dataset.delta).toBe("15");
  });
});
