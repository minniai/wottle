import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoundSummaryPanel } from "@/components/match/RoundSummaryPanel";
import type { RoundSummary } from "@/lib/types/match";

const baseSummary: RoundSummary = {
  matchId: "match-123",
  roundNumber: 3,
  words: [
    {
      playerId: "player-a",
      word: "test",
      length: 4,
      lettersPoints: 4,
      bonusPoints: 2,
      totalPoints: 6,
      coordinates: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    },
  ],
  deltas: { playerA: 6, playerB: 0 },
  totals: { playerA: 12, playerB: 4 },
  highlights: [],
  resolvedAt: new Date().toISOString(),
  moves: [],
};

describe("RoundSummaryPanel accessibility", () => {
  it("announces new summaries via the live region", () => {
    render(
      <RoundSummaryPanel
        summary={baseSummary}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    const liveRegion = screen.getByTestId("round-summary-live-region");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion.textContent).toContain("Round 3 complete");
    expect(liveRegion.textContent).toContain("You gained 6 points");
    expect(liveRegion.textContent).toContain("Opponent scored 0 points");
  });

  it("moves focus to the panel whenever the summary changes", async () => {
    const { rerender } = render(
      <RoundSummaryPanel
        summary={baseSummary}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    const panel = screen.getByTestId("round-summary-panel");
    await waitFor(() => expect(document.activeElement).toBe(panel));

    rerender(
      <RoundSummaryPanel
        summary={{ ...baseSummary, roundNumber: 4, deltas: { playerA: 0, playerB: 5 } }}
        currentPlayerId="player-a"
        playerAId="player-a"
        autoDismissMs={0}
      />,
    );

    await waitFor(() => expect(document.activeElement).toBe(panel));
  });
});


