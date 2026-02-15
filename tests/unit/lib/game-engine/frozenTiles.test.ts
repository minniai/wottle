import { describe, expect, test } from "vitest";

import {
  freezeTiles,
  isFrozen,
  isFrozenByOpponent,
  toFrozenKey,
} from "@/lib/game-engine/frozenTiles";
import type { FrozenTileMap, WordScoreBreakdown } from "@/lib/types/match";

const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";

function makeWord(
  playerId: string,
  tiles: Array<{ x: number; y: number }>,
): WordScoreBreakdown {
  return {
    word: "test",
    length: tiles.length,
    lettersPoints: 10,
    lengthBonus: 5,
    totalPoints: 15,
    isDuplicate: false,
    tiles,
    playerId,
  };
}

describe("frozenTiles", () => {
  describe("toFrozenKey", () => {
    test("should produce 'x,y' format", () => {
      expect(toFrozenKey({ x: 3, y: 5 })).toBe("3,5");
      expect(toFrozenKey({ x: 0, y: 0 })).toBe("0,0");
      expect(toFrozenKey({ x: 9, y: 9 })).toBe("9,9");
    });
  });

  describe("isFrozen", () => {
    test("should return true for a frozen coordinate", () => {
      const map: FrozenTileMap = { "3,5": { owner: "player_a" } };
      expect(isFrozen(map, { x: 3, y: 5 })).toBe(true);
    });

    test("should return false for an unfrozen coordinate", () => {
      const map: FrozenTileMap = { "3,5": { owner: "player_a" } };
      expect(isFrozen(map, { x: 0, y: 0 })).toBe(false);
    });

    test("should return true for tiles owned by 'both'", () => {
      const map: FrozenTileMap = { "2,0": { owner: "both" } };
      expect(isFrozen(map, { x: 2, y: 0 })).toBe(true);
    });
  });

  describe("isFrozenByOpponent", () => {
    test("should return true when tile is owned by the opponent", () => {
      const map: FrozenTileMap = { "3,5": { owner: "player_b" } };
      expect(isFrozenByOpponent(map, { x: 3, y: 5 }, "player_a")).toBe(
        true,
      );
    });

    test("should return false when tile is owned by the same player", () => {
      const map: FrozenTileMap = { "3,5": { owner: "player_a" } };
      expect(isFrozenByOpponent(map, { x: 3, y: 5 }, "player_a")).toBe(
        false,
      );
    });

    test("should return false when tile is owned by 'both'", () => {
      const map: FrozenTileMap = { "3,5": { owner: "both" } };
      expect(isFrozenByOpponent(map, { x: 3, y: 5 }, "player_a")).toBe(
        false,
      );
    });

    test("should return false when tile is not frozen at all", () => {
      const map: FrozenTileMap = {};
      expect(isFrozenByOpponent(map, { x: 3, y: 5 }, "player_a")).toBe(
        false,
      );
    });
  });

  describe("freezeTiles", () => {
    test("should add all tile coordinates from scored words to the map", () => {
      const word = makeWord(PLAYER_A, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]);

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["0,0"]).toEqual({
        owner: "player_a",
      });
      expect(result.updatedFrozenTiles["1,0"]).toEqual({
        owner: "player_a",
      });
      expect(result.updatedFrozenTiles["2,0"]).toEqual({
        owner: "player_a",
      });
      expect(result.newlyFrozen).toHaveLength(3);
    });

    test("should set dual ownership when both players claim same tile", () => {
      const wordA = makeWord(PLAYER_A, [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]);
      const wordB = makeWord(PLAYER_B, [
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ]);

      const result = freezeTiles({
        scoredWords: [wordA, wordB],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["2,0"]).toEqual({
        owner: "both",
      });
      expect(result.updatedFrozenTiles["3,0"]).toEqual({
        owner: "player_a",
      });
      expect(result.updatedFrozenTiles["2,1"]).toEqual({
        owner: "player_b",
      });
    });

    test("should upgrade existing single ownership to 'both' when opponent claims same tile", () => {
      const existing: FrozenTileMap = {
        "2,0": { owner: "player_a" },
      };
      const wordB = makeWord(PLAYER_B, [
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ]);

      const result = freezeTiles({
        scoredWords: [wordB],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["2,0"]).toEqual({
        owner: "both",
      });
    });

    test("should enforce 24-unfrozen minimum (76 max frozen)", () => {
      // Create existing frozen tiles for 74 positions (leaving 26 unfrozen)
      const existing: FrozenTileMap = {};
      for (let i = 0; i < 74; i++) {
        const x = i % 10;
        const y = Math.floor(i / 10);
        existing[`${x},${y}`] = { owner: "player_a" };
      }

      // Try to freeze 4 more tiles (would leave only 22 unfrozen < 24)
      const word = makeWord(PLAYER_A, [
        { x: 4, y: 7 },
        { x: 5, y: 7 },
        { x: 6, y: 7 },
        { x: 7, y: 7 },
      ]);

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Should only freeze 2 tiles (76 - 74 = 2 remaining capacity)
      expect(result.newlyFrozen).toHaveLength(2);
      expect(result.wasPartialFreeze).toBe(true);
      expect(result.unfrozenRemaining).toBe(24);
    });

    test("should freeze in reading order (row first, then column) when partial", () => {
      // 75 tiles already frozen → only 1 more allowed
      const existing: FrozenTileMap = {};
      for (let i = 0; i < 75; i++) {
        const x = i % 10;
        const y = Math.floor(i / 10);
        existing[`${x},${y}`] = { owner: "player_a" };
      }

      // Word with tiles at (7,7) and (8,7) — reading order: (7,7) first
      const word = makeWord(PLAYER_B, [
        { x: 8, y: 7 },
        { x: 7, y: 7 },
      ]);

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.newlyFrozen).toHaveLength(1);
      // (7,7) comes before (8,7) in reading order
      expect(result.newlyFrozen[0]).toEqual({ x: 7, y: 7 });
    });

    test("should merge with existing frozen tiles without removing any", () => {
      const existing: FrozenTileMap = {
        "0,0": { owner: "player_a" },
        "1,0": { owner: "player_b" },
      };

      const word = makeWord(PLAYER_A, [{ x: 5, y: 5 }]);

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["0,0"]).toEqual({
        owner: "player_a",
      });
      expect(result.updatedFrozenTiles["1,0"]).toEqual({
        owner: "player_b",
      });
      expect(result.updatedFrozenTiles["5,5"]).toEqual({
        owner: "player_a",
      });
    });

    test("should skip duplicate words when freezing", () => {
      const word = makeWord(PLAYER_A, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);
      word.isDuplicate = true;

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Duplicate words should not freeze tiles
      expect(result.newlyFrozen).toHaveLength(0);
    });
  });
});
