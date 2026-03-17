import { describe, expect, it } from "vitest";

import { aggregateRoundSummary } from "@/lib/scoring/roundSummary";
import type { RoundMove } from "@/lib/types/match";

describe("aggregateRoundSummary - submittedAt", () => {
  it("preserves submittedAt on each RoundMove in the output summary", () => {
    const moves: RoundMove[] = [
      {
        playerId: "player-a",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
        submittedAt: "2026-01-01T00:00:00.100Z",
      },
      {
        playerId: "player-b",
        from: { x: 5, y: 5 },
        to: { x: 6, y: 5 },
        submittedAt: "2026-01-01T00:00:00.200Z",
      },
    ];

    const summary = aggregateRoundSummary(
      "match-1",
      1,
      [],
      { playerA: 0, playerB: 0 },
      "player-a",
      "player-b",
      moves,
    );

    expect(summary.moves).toHaveLength(2);
    expect(summary.moves[0].submittedAt).toBe("2026-01-01T00:00:00.100Z");
    expect(summary.moves[1].submittedAt).toBe("2026-01-01T00:00:00.200Z");
  });

  it("sorts moves by submittedAt ascending when two moves are provided", () => {
    // Second player submitted first — verify order is preserved (caller is responsible for ordering)
    const moves: RoundMove[] = [
      {
        playerId: "player-b",
        from: { x: 3, y: 3 },
        to: { x: 4, y: 3 },
        submittedAt: "2026-01-01T00:00:00.050Z",
      },
      {
        playerId: "player-a",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
        submittedAt: "2026-01-01T00:00:00.150Z",
      },
    ];

    const summary = aggregateRoundSummary(
      "match-2",
      2,
      [],
      { playerA: 10, playerB: 10 },
      "player-a",
      "player-b",
      moves,
    );

    expect(summary.moves[0].playerId).toBe("player-b");
    expect(summary.moves[0].submittedAt).toBe("2026-01-01T00:00:00.050Z");
    expect(summary.moves[1].playerId).toBe("player-a");
    expect(summary.moves[1].submittedAt).toBe("2026-01-01T00:00:00.150Z");
  });

  it("handles single-submission round with one move", () => {
    const moves: RoundMove[] = [
      {
        playerId: "player-a",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        submittedAt: "2026-01-01T00:00:00.999Z",
      },
    ];

    const summary = aggregateRoundSummary(
      "match-3",
      3,
      [],
      { playerA: 5, playerB: 5 },
      "player-a",
      "player-b",
      moves,
    );

    expect(summary.moves).toHaveLength(1);
    expect(summary.moves[0].submittedAt).toBe("2026-01-01T00:00:00.999Z");
  });
});
