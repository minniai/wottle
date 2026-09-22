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
    const bothDone = { playerA: 10, playerB: 10 };
    const decide = (
      scores: { playerA: number; playerB: number },
      moves = bothDone,
      frozenCounts = noFrozen,
    ) => determineMatchWinner({ scores, moves, moveLimit: 10, frozenCounts }, playerAId, playerBId);

    // Rules §2a (amended 2026-09-21): a short player is not a default loser; unplayed
    // moves are penalised into the score beforehand, and the score decides.
    it("a player short of ten moves can still win on score; the reason records the shortfall (incomplete)", () => {
      const result = decide({ playerA: 134, playerB: 88 }, { playerA: 8, playerB: 10 });
      expect(result).toEqual({ winnerId: playerAId, loserId: playerBId, isDraw: false, reason: "incomplete" });
    });

    it("both short of ten: the score still decides (both_incomplete)", () => {
      const result = decide({ playerA: 70, playerB: 88 }, { playerA: 9, playerB: 3 });
      expect(result).toEqual({ winnerId: playerBId, loserId: playerAId, isDraw: false, reason: "both_incomplete" });
    });

    it("both short and level on score and tiles is a draw", () => {
      expect(decide({ playerA: 10, playerB: 10 }, { playerA: 9, playerB: 3 })).toEqual({ winnerId: null, loserId: null, isDraw: true, reason: "both_incomplete" });
    });

    it("negative totals compare as numbers", () => {
      expect(decide({ playerA: -12, playerB: -4 }).winnerId).toBe(playerBId);
    });

    it("returns player A when both finished and their score is higher", () => {
      const result = decide({ playerA: 120, playerB: 90 });
      expect(result).toEqual({ winnerId: playerAId, loserId: playerBId, isDraw: false, reason: "moves_complete" });
    });

    it("returns player B when both finished and their score is higher", () => {
      const result = decide({ playerA: 75, playerB: 110 });
      expect(result.winnerId).toBe(playerBId);
      expect(result.loserId).toBe(playerAId);
      expect(result.isDraw).toBe(false);
    });

    // Regression for GitHub issue #117: a 56 vs 96 match was rendering as
    // "Draw." because the match row was persisted with winner_id=null.
    it("issue #117: 56 vs 96 is a decisive player B win, not a draw", () => {
      const result = decide({ playerA: 56, playerB: 96 });
      expect(result.winnerId).toBe(playerBId);
      expect(result.isDraw).toBe(false);
    });

    it("returns draw when scores match and frozen tiles are equal", () => {
      const result = decide({ playerA: 100, playerB: 100 });
      expect(result).toEqual({ winnerId: null, loserId: null, isDraw: true, reason: "moves_complete" });
    });

    // T016: tiebreaker tests — equal scores resolved by exclusively-owned frozen tiles

    it("T016a: higher score wins regardless of frozen tile counts", () => {
      const result = decide({ playerA: 120, playerB: 90 }, bothDone, { playerA: 1, playerB: 10 });
      expect(result.winnerId).toBe(playerAId);
    });

    it("T016b: equal scores + more frozen tiles for A → A wins", () => {
      const result = decide({ playerA: 100, playerB: 100 }, bothDone, { playerA: 3, playerB: 1 });
      expect(result.winnerId).toBe(playerAId);
      expect(result.loserId).toBe(playerBId);
    });

    it("T016c: equal scores + more frozen tiles for B → B wins", () => {
      const result = decide({ playerA: 100, playerB: 100 }, bothDone, { playerA: 2, playerB: 5 });
      expect(result.winnerId).toBe(playerBId);
    });

    it("T016d: equal scores + equal frozen tiles → draw (winnerId = null)", () => {
      const result = decide({ playerA: 100, playerB: 100 }, bothDone, { playerA: 4, playerB: 4 });
      expect(result.winnerId).toBe(null);
      expect(result.isDraw).toBe(true);
    });

    it("T016e: both scores 0 and both frozen 0 → draw", () => {
      const result = decide({ playerA: 0, playerB: 0 });
      expect(result.isDraw).toBe(true);
    });

    it("the move limit is read from the input, not assumed", () => {
      const result = determineMatchWinner(
        { scores: { playerA: 1, playerB: 2 }, moves: { playerA: 3, playerB: 3 }, moveLimit: 3, frozenCounts: noFrozen },
        playerAId,
        playerBId,
      );
      expect(result.reason).toBe("moves_complete");
      expect(result.winnerId).toBe(playerBId);
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
