import { describe, expect, it } from "vitest";

import { partialRoundSummarySchema } from "@/lib/match/schemas";

const VALID_PARTIAL = {
  matchId: "11111111-1111-1111-1111-111111111111",
  roundNumber: 3,
  firstMoverId: "22222222-2222-2222-2222-222222222222",
  firstSubmissionAt: "2026-06-09T12:00:00.000Z",
  words: [
    {
      playerId: "22222222-2222-2222-2222-222222222222",
      word: "köttur",
      length: 6,
      lettersPoints: 8,
      bonusPoints: 20,
      totalPoints: 28,
      coordinates: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 6, y: 2 },
      ],
    },
  ],
  delta: { playerA: 28, playerB: 0 },
  frozenTiles: {
    "1,2": { owner: "player_a" },
    "2,2": { owner: "player_a" },
  },
};

describe("partialRoundSummarySchema (T003)", () => {
  it("parses a valid PartialRoundSummary payload", () => {
    const result = partialRoundSummarySchema.parse(VALID_PARTIAL);

    expect(result.matchId).toBe(VALID_PARTIAL.matchId);
    expect(result.roundNumber).toBe(3);
    expect(result.words).toHaveLength(1);
    expect(result.frozenTiles["1,2"]?.owner).toBe("player_a");
  });

  it("rejects a payload with a non-UUID matchId", () => {
    const bad = { ...VALID_PARTIAL, matchId: "not-a-uuid" };
    expect(() => partialRoundSummarySchema.parse(bad)).toThrow();
  });

  it("rejects a payload with roundNumber > 10", () => {
    const bad = { ...VALID_PARTIAL, roundNumber: 11 };
    expect(() => partialRoundSummarySchema.parse(bad)).toThrow();
  });

  it("rejects a payload with roundNumber < 1", () => {
    const bad = { ...VALID_PARTIAL, roundNumber: 0 };
    expect(() => partialRoundSummarySchema.parse(bad)).toThrow();
  });

  it("rejects a payload where words exceeds the defensive max of 20", () => {
    const bad = {
      ...VALID_PARTIAL,
      words: Array.from({ length: 21 }, () => VALID_PARTIAL.words[0]),
    };
    expect(() => partialRoundSummarySchema.parse(bad)).toThrow();
  });

  it("rejects a payload with an invalid frozen-tile owner", () => {
    const bad = {
      ...VALID_PARTIAL,
      frozenTiles: { "1,2": { owner: "player_c" } },
    };
    expect(() => partialRoundSummarySchema.parse(bad)).toThrow();
  });

  it("rejects a payload with a non-ISO firstSubmissionAt", () => {
    const bad = { ...VALID_PARTIAL, firstSubmissionAt: "yesterday" };
    expect(() => partialRoundSummarySchema.parse(bad)).toThrow();
  });
});
