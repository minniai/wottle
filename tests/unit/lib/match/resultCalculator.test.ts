import { describe, expect, it } from "vitest";

import {
  assertRematchAllowed,
  determineMatchWinner,
} from "../../../../lib/match/resultCalculator";

describe("resultCalculator", () => {
  describe("determineMatchWinner", () => {
    const playerAId = "player-a";
    const playerBId = "player-b";

    it("returns player A when their score is higher", () => {
      const result = determineMatchWinner(
        { playerA: 120, playerB: 90 },
        playerAId,
        playerBId,
      );
      expect(result).toEqual({
        winnerId: playerAId,
        loserId: playerBId,
        isDraw: false,
      });
    });

    it("returns player B when their score is higher", () => {
      const result = determineMatchWinner(
        { playerA: 75, playerB: 110 },
        playerAId,
        playerBId,
      );
      expect(result.winnerId).toBe(playerBId);
      expect(result.loserId).toBe(playerAId);
      expect(result.isDraw).toBe(false);
    });

    it("returns draw when scores match", () => {
      const result = determineMatchWinner(
        { playerA: 100, playerB: 100 },
        playerAId,
        playerBId,
      );
      expect(result).toEqual({
        winnerId: null,
        loserId: null,
        isDraw: true,
      });
    });
  });

  describe("assertRematchAllowed", () => {
    const baseMatch = {
      state: "completed" as const,
      playerAId: "player-a",
      playerBId: "player-b",
    };

    it("allows rematch when match completed and player participated", () => {
      expect(() => assertRematchAllowed(baseMatch, "player-a")).not.toThrow();
    });

    it("rejects when match still in progress", () => {
      expect(() =>
        assertRematchAllowed({ ...baseMatch, state: "in_progress" }, "player-a"),
      ).toThrow(/not finished/i);
    });

    it("rejects when requester was not part of the match", () => {
      expect(() =>
        assertRematchAllowed(baseMatch, "spectator"),
      ).toThrow(/participant/i);
    });
  });
});

