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

    test("should return true for tiles owned by either player", () => {
      const map: FrozenTileMap = { "2,0": { owner: "player_b" } };
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

    test("should return true when tile is owned by opponent (first-owner-wins)", () => {
      const map: FrozenTileMap = { "3,5": { owner: "player_b" } };
      expect(isFrozenByOpponent(map, { x: 3, y: 5 }, "player_a")).toBe(
        true,
      );
    });

    test("should return false when tile is not frozen at all", () => {
      const map: FrozenTileMap = {};
      expect(isFrozenByOpponent(map, { x: 3, y: 5 }, "player_a")).toBe(
        false,
      );
    });
  });

  // T039: resolveOwnership returns existing owner (first-owner-wins)
  describe("resolveOwnership via freezeTiles (T039)", () => {
    test("keeps player_a ownership when player_b tries to claim same tile", () => {
      const existing: FrozenTileMap = {
        "3,3": { owner: "player_a" },
      };
      const wordB = makeWord(PLAYER_B, [{ x: 3, y: 3 }]);

      const result = freezeTiles({
        scoredWords: [wordB],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["3,3"].owner).toBe("player_a");
    });

    test("keeps player_b ownership when player_a tries to claim same tile", () => {
      const existing: FrozenTileMap = {
        "5,5": { owner: "player_b" },
      };
      const wordA = makeWord(PLAYER_A, [{ x: 5, y: 5 }]);

      const result = freezeTiles({
        scoredWords: [wordA],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["5,5"].owner).toBe("player_b");
    });
  });

  // T040: freezeTiles never produces "both" ownership
  describe("no 'both' ownership (T040)", () => {
    test("all frozen tiles have exactly one owner after freeze", () => {
      const wordA = makeWord(PLAYER_A, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]);
      const wordB = makeWord(PLAYER_B, [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ]);

      const result = freezeTiles({
        scoredWords: [wordA, wordB],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      for (const [, tile] of Object.entries(result.updatedFrozenTiles)) {
        expect(["player_a", "player_b"]).toContain(tile.owner);
      }
    });
  });

  // T041: isFrozenByOpponent returns correct values (no "both" case)
  describe("isFrozenByOpponent exclusive ownership (T041)", () => {
    test("returns true only for opponent-owned tiles", () => {
      const map: FrozenTileMap = {
        "0,0": { owner: "player_a" },
        "1,1": { owner: "player_b" },
      };
      // From player_a's perspective:
      expect(isFrozenByOpponent(map, { x: 0, y: 0 }, "player_a")).toBe(false);
      expect(isFrozenByOpponent(map, { x: 1, y: 1 }, "player_a")).toBe(true);
      // From player_b's perspective:
      expect(isFrozenByOpponent(map, { x: 0, y: 0 }, "player_b")).toBe(true);
      expect(isFrozenByOpponent(map, { x: 1, y: 1 }, "player_b")).toBe(false);
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

      expect(result.updatedFrozenTiles["0,0"].owner).toBe("player_a");
      expect(result.updatedFrozenTiles["1,0"].owner).toBe("player_a");
      expect(result.updatedFrozenTiles["2,0"].owner).toBe("player_a");
      expect(result.newlyFrozen).toHaveLength(3);
    });

    test("should use first-owner-wins when both players claim same tile", () => {
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

      // First-owner-wins: player_a claimed tile (2,0) first
      expect(result.updatedFrozenTiles["2,0"].owner).toBe("player_a");
      expect(result.updatedFrozenTiles["3,0"].owner).toBe("player_a");
      expect(result.updatedFrozenTiles["2,1"].owner).toBe("player_b");
    });

    test("should keep existing owner when opponent claims same tile (first-owner-wins)", () => {
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

      // First-owner-wins: player_a already owns tile (2,0)
      expect(result.updatedFrozenTiles["2,0"].owner).toBe("player_a");
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

      expect(result.updatedFrozenTiles["0,0"].owner).toBe("player_a");
      expect(result.updatedFrozenTiles["1,0"].owner).toBe("player_b");
      expect(result.updatedFrozenTiles["5,5"].owner).toBe("player_a");
    });

    test("should freeze all scored word tiles (no duplicate filtering)", () => {
      const word = makeWord(PLAYER_A, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.newlyFrozen).toHaveLength(2);
    });

    // ─── T067-T070: scoredAxes population ────────────────────────────

    // T067: Horizontal word stores scoredAxes: ["horizontal"]
    test("T067: stores scoredAxes horizontal for horizontal word tiles", () => {
      const word: WordScoreBreakdown = {
        word: "abc",
        length: 3,
        lettersPoints: 10,
        lengthBonus: 5,
        totalPoints: 15,
        tiles: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        playerId: PLAYER_A,
      };

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["0,0"].scoredAxes).toEqual(["horizontal"]);
      expect(result.updatedFrozenTiles["1,0"].scoredAxes).toEqual(["horizontal"]);
      expect(result.updatedFrozenTiles["2,0"].scoredAxes).toEqual(["horizontal"]);
    });

    // T068: Vertical word stores scoredAxes: ["vertical"]
    test("T068: stores scoredAxes vertical for vertical word tiles", () => {
      const word: WordScoreBreakdown = {
        word: "abc",
        length: 3,
        lettersPoints: 10,
        lengthBonus: 5,
        totalPoints: 15,
        tiles: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: 2 },
        ],
        playerId: PLAYER_B,
      };

      const result = freezeTiles({
        scoredWords: [word],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.updatedFrozenTiles["0,0"].scoredAxes).toEqual(["vertical"]);
      expect(result.updatedFrozenTiles["0,1"].scoredAxes).toEqual(["vertical"]);
      expect(result.updatedFrozenTiles["0,2"].scoredAxes).toEqual(["vertical"]);
    });

    // T069: Merges axes when tile is scored on both axes
    test("T069: merges scoredAxes when tile is scored on both horizontal and vertical", () => {
      const hWordScore: WordScoreBreakdown = {
        word: "abc",
        length: 3,
        lettersPoints: 10,
        lengthBonus: 5,
        totalPoints: 15,
        tiles: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
        playerId: PLAYER_A,
      };
      const vWordScore: WordScoreBreakdown = {
        word: "def",
        length: 3,
        lettersPoints: 10,
        lengthBonus: 5,
        totalPoints: 15,
        tiles: [
          { x: 1, y: 0 },
          { x: 1, y: 1 }, // shared tile
          { x: 1, y: 2 },
        ],
        playerId: PLAYER_A,
      };

      const result = freezeTiles({
        scoredWords: [hWordScore, vWordScore],
        existingFrozenTiles: {},
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Shared tile at (1,1) should have both axes
      const axes = result.updatedFrozenTiles["1,1"].scoredAxes;
      expect(axes).toContain("horizontal");
      expect(axes).toContain("vertical");
      expect(axes).toHaveLength(2);
    });

    // T070: Preserves scoredAxes on ownership upgrade
    test("T070: preserves and merges scoredAxes on ownership upgrade", () => {
      const existing: FrozenTileMap = {
        "1,1": { owner: "player_a", scoredAxes: ["horizontal"] },
      };
      const vWordScore: WordScoreBreakdown = {
        word: "def",
        length: 3,
        lettersPoints: 10,
        lengthBonus: 5,
        totalPoints: 15,
        tiles: [
          { x: 1, y: 0 },
          { x: 1, y: 1 }, // already frozen, new vertical axis
          { x: 1, y: 2 },
        ],
        playerId: PLAYER_B,
      };

      const result = freezeTiles({
        scoredWords: [vWordScore],
        existingFrozenTiles: existing,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Owner stays player_a (first-owner-wins)
      expect(result.updatedFrozenTiles["1,1"].owner).toBe("player_a");
      // Axes merged: existing "horizontal" + new "vertical"
      const axes = result.updatedFrozenTiles["1,1"].scoredAxes;
      expect(axes).toContain("horizontal");
      expect(axes).toContain("vertical");
    });
  });
});
