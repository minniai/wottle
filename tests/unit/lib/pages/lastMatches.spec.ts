import { describe, expect, it } from "vitest";

import { rowsAfter } from "@/lib/pages/lastMatches";
import type { RecentGameRow } from "@/lib/types/lobby";

const game = (id: string): RecentGameRow => ({
  matchId: id, result: "win", opponentId: "o", opponentUsername: "kari", opponentDisplayName: "Kári", yourScore: 1, opponentScore: 0, wordsFound: 1, completedAt: "2026-09-25T00:00:00Z",
});

/** One list of last matches: the first drawn as its board, the rest as rows. */
describe("rowsAfter", () => {
  it("leaves out the match already drawn and keeps the next three", () => {
    const rows = rowsAfter(["a", "b", "c", "d", "e"].map(game), "a");
    expect(rows.map((r) => r.matchId)).toEqual(["b", "c", "d"]);
  });

  it("keeps three when the drawn match is not in the list", () => {
    expect(rowsAfter(["b", "c", "d", "e"].map(game), "a").map((r) => r.matchId)).toEqual(["b", "c", "d"]);
  });
});
