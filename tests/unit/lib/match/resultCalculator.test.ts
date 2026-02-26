import { describe, expect, it } from "vitest";

import {
  assertRematchAllowed,
  determineMatchWinner,
} from "@/lib/match/resultCalculator";

describe("resultCalculator", () => {
  describe("determineMatchWinner", () => {
    const playerAId = "player-a";
    const playerBId = "player-b";
    const noFrozen = { playerA: 0, playerB: 0 };

    it("returns player A when their score is higher", () => {
      const result = determineMatchWinner(
        { playerA: 120, playerB: 90 },
        playerAId,
        playerBId,
        noFrozen,
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
        noFrozen,
      );
      expect(result.winnerId).toBe(playerBId);
      expect(result.loserId).toBe(playerAId);
      expect(result.isDraw).toBe(false);
    });

    it("returns draw when scores match and frozen tiles are equal", () => {
      const result = determineMatchWinner(
        { playerA: 100, playerB: 100 },
        playerAId,
        playerBId,
        noFrozen,
      );
      expect(result).toEqual({
        winnerId: null,
        loserId: null,
        isDraw: true,
      });
    });

    // T016: tiebreaker tests — equal scores resolved by exclusively-owned frozen tiles

    it("T016a: higher score wins regardless of frozen tile counts", () => {
      const result = determineMatchWinner(
        { playerA: 120, playerB: 90 },
        playerAId,
        playerBId,
        { playerA: 1, playerB: 10 }, // B has more frozen tiles but A has higher score
      );
      expect(result.winnerId).toBe(playerAId);
      expect(result.isDraw).toBe(false);
    });

    it("T016b: equal scores + more frozen tiles for A → A wins", () => {
      const result = determineMatchWinner(
        { playerA: 100, playerB: 100 },
        playerAId,
        playerBId,
        { playerA: 3, playerB: 1 },
      );
      expect(result.winnerId).toBe(playerAId);
      expect(result.loserId).toBe(playerBId);
      expect(result.isDraw).toBe(false);
    });

    it("T016c: equal scores + more frozen tiles for B → B wins", () => {
      const result = determineMatchWinner(
        { playerA: 100, playerB: 100 },
        playerAId,
        playerBId,
        { playerA: 2, playerB: 5 },
      );
      expect(result.winnerId).toBe(playerBId);
      expect(result.loserId).toBe(playerAId);
      expect(result.isDraw).toBe(false);
    });

    it("T016d: equal scores + equal frozen tiles → draw (winnerId = null)", () => {
      const result = determineMatchWinner(
        { playerA: 100, playerB: 100 },
        playerAId,
        playerBId,
        { playerA: 4, playerB: 4 },
      );
      expect(result.winnerId).toBe(null);
      expect(result.isDraw).toBe(true);
    });

    it("T016e: both scores 0 and both frozen 0 → draw", () => {
      const result = determineMatchWinner(
        { playerA: 0, playerB: 0 },
        playerAId,
        playerBId,
        { playerA: 0, playerB: 0 },
      );
      expect(result.winnerId).toBe(null);
      expect(result.isDraw).toBe(true);
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
