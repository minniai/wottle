import { describe, expect, it } from "vitest";

import { deriveSeriesContext, walkRematchChain } from "@/lib/match/rematchService";
import type { RematchRequest } from "@/lib/types/match";

function makeRequest(
  overrides: Partial<RematchRequest> = {},
): RematchRequest {
  return {
    id: "req-1",
    matchId: "match-1",
    requesterId: "player-a",
    responderId: "player-b",
    status: "pending",
    newMatchId: null,
    createdAt: new Date().toISOString(),
    respondedAt: null,
    ...overrides,
  };
}

describe("walkRematchChain", () => {
  it("returns single match when no rematch_of", () => {
    const matches = [{ id: "m1", rematchOf: null, winnerId: null }];
    expect(walkRematchChain(matches, "m1")).toEqual(["m1"]);
  });

  it("walks chain backward", () => {
    const matches = [
      { id: "m1", rematchOf: null, winnerId: "p1" },
      { id: "m2", rematchOf: "m1", winnerId: "p2" },
      { id: "m3", rematchOf: "m2", winnerId: null },
    ];
    expect(walkRematchChain(matches, "m3")).toEqual(["m1", "m2", "m3"]);
  });

  it("handles chain of 1 (first game)", () => {
    const matches = [
      { id: "m1", rematchOf: null, winnerId: "p1" },
      { id: "m2", rematchOf: "m1", winnerId: null },
    ];
    expect(walkRematchChain(matches, "m1")).toEqual(["m1"]);
  });

  it("handles circular references gracefully", () => {
    const matches = [
      { id: "m1", rematchOf: "m2", winnerId: null },
      { id: "m2", rematchOf: "m1", winnerId: null },
    ];
    const chain = walkRematchChain(matches, "m1");
    // Should not loop infinitely
    expect(chain.length).toBeLessThanOrEqual(2);
  });
});

describe("deriveSeriesContext", () => {
  it("returns game 1 for single match", () => {
    const matches = [{ id: "m1", rematchOf: null, winnerId: "p1" }];
    const chain = ["m1"];
    const result = deriveSeriesContext(matches, chain, "p1");
    expect(result).toEqual({
      gameNumber: 1,
      currentPlayerWins: 1,
      opponentWins: 0,
      draws: 0,
    });
  });

  it("derives correct context for game 3 in a series", () => {
    const matches = [
      { id: "m1", rematchOf: null, winnerId: "p1" },
      { id: "m2", rematchOf: "m1", winnerId: "p2" },
      { id: "m3", rematchOf: "m2", winnerId: "p1" },
    ];
    const chain = ["m1", "m2", "m3"];
    const result = deriveSeriesContext(matches, chain, "p1");
    expect(result).toEqual({
      gameNumber: 3,
      currentPlayerWins: 2,
      opponentWins: 1,
      draws: 0,
    });
  });

  it("counts draws correctly", () => {
    const matches = [
      { id: "m1", rematchOf: null, winnerId: null },
      { id: "m2", rematchOf: "m1", winnerId: "p1" },
    ];
    const chain = ["m1", "m2"];
    const result = deriveSeriesContext(matches, chain, "p1");
    expect(result).toEqual({
      gameNumber: 2,
      currentPlayerWins: 1,
      opponentWins: 0,
      draws: 1,
    });
  });

  it("derives from opponent perspective", () => {
    const matches = [
      { id: "m1", rematchOf: null, winnerId: "p1" },
      { id: "m2", rematchOf: "m1", winnerId: "p1" },
    ];
    const chain = ["m1", "m2"];
    const result = deriveSeriesContext(matches, chain, "p2");
    expect(result).toEqual({
      gameNumber: 2,
      currentPlayerWins: 0,
      opponentWins: 2,
      draws: 0,
    });
  });
});
