import { describe, expect, test, beforeAll, vi } from "vitest";

import { processRoundScoring } from "@/lib/game-engine/wordEngine";
import { calculateComboBonus } from "@/lib/game-engine/scorer";
import { loadDictionary } from "@/lib/game-engine/dictionary";
import * as boardScanner from "@/lib/game-engine/boardScanner";
import * as deltaDetector from "@/lib/game-engine/deltaDetector";
import * as scorer from "@/lib/game-engine/scorer";
import * as frozenTiles from "@/lib/game-engine/frozenTiles";
import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

function emptyBoard(fill = " "): BoardGrid {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => fill),
  ) as BoardGrid;
}

function placeHorizontal(
  board: BoardGrid,
  word: string,
  x: number,
  y: number,
): BoardGrid {
  const copy = board.map((row) => [...row]) as BoardGrid;
  for (let i = 0; i < word.length; i++) {
    copy[y][x + i] = word[i];
  }
  return copy;
}

const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";
const MATCH_ID = "match-123";
const ROUND_ID = "round-456";
const EMPTY_FROZEN: FrozenTileMap = {};

describe("wordEngine", () => {
  beforeAll(async () => {
    await loadDictionary();
  });

  /** Create a board where swapping (0,0) ↔ (5,0) forms "hestur" at row 0. */
  function makeHesturSetup(): {
    boardBefore: BoardGrid;
    boardAfter: BoardGrid;
  } {
    const boardBefore = emptyBoard();
    // "restur" before swap — 'h' is at (5,0), 'r' is at (0,0)
    boardBefore[0][0] = "r";
    boardBefore[0][1] = "e";
    boardBefore[0][2] = "s";
    boardBefore[0][3] = "t";
    boardBefore[0][4] = "u";
    boardBefore[0][5] = "h";

    // After Player A swaps (0,0)↔(5,0): h→(0,0), r→(5,0), forming "hestur"
    const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
    boardAfter[0][0] = "h";
    boardAfter[0][5] = "r";

    return { boardBefore, boardAfter };
  }

  test("should return RoundScoreResult with all required fields", async () => {
    const { boardBefore, boardAfter } = makeHesturSetup();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore,
      boardAfter,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    expect(result).toHaveProperty("playerAWords");
    expect(result).toHaveProperty("playerBWords");
    expect(result).toHaveProperty("comboBonus");
    expect(result).toHaveProperty("deltas");
    expect(result).toHaveProperty("durationMs");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("should score 'hestur' with correct letter points and length bonus", async () => {
    const { boardBefore, boardAfter } = makeHesturSetup();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore,
      boardAfter,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const hestur = result.playerAWords.find(
      (w) => w.word === "hestur",
    );
    expect(hestur).toBeDefined();
    // H=3, E=2, S=1, T=1, U=1, R=1 = 9
    expect(hestur!.lettersPoints).toBe(9);
    // (6-2)*5 = 20
    expect(hestur!.lengthBonus).toBe(20);
    // 9 + 20 = 29
    expect(hestur!.totalPoints).toBe(29);
  });

  test("should return zero deltas when no new words are formed", async () => {
    const board = emptyBoard();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore: board,
      boardAfter: board,
      acceptedMoves: [],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    expect(result.deltas).toEqual({ playerA: 0, playerB: 0 });
    expect(result.playerAWords).toHaveLength(0);
    expect(result.playerBWords).toHaveLength(0);
  });

  test("should include score deltas accounting for all scored words", async () => {
    const { boardBefore, boardAfter } = makeHesturSetup();

    const result = await processRoundScoring({
      matchId: MATCH_ID,
      roundId: ROUND_ID,
      boardBefore,
      boardAfter,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    // Player A delta should include at least the "hestur" word total (29)
    // plus any other subwords that happen to be valid
    expect(result.deltas.playerA).toBeGreaterThanOrEqual(29);
    expect(result.deltas.playerB).toBe(0);
  });

  describe("duplicate word tracking (US3)", () => {
    test("same player forms same word in two rounds - second marked isDuplicate and 0 points", async () => {
      const { boardBefore, boardAfter } = makeHesturSetup();
      const priorScoredWordsByPlayer: Record<string, Set<string>> = {
        [PLAYER_A]: new Set(["hestur"]),
      };

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: "round-2",
        boardBefore,
        boardAfter,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        priorScoredWordsByPlayer,
      });

      const hestur = result.playerAWords.find((w) => w.word === "hestur");
      expect(hestur).toBeDefined();
      expect(hestur!.isDuplicate).toBe(true);
      expect(hestur!.totalPoints).toBe(0);
    });

    test("different player forms same word - full points awarded (per-player tracking)", async () => {
      const { boardBefore, boardAfter } = makeHesturSetup();
      const priorScoredWordsByPlayer: Record<string, Set<string>> = {
        [PLAYER_A]: new Set(["hestur"]),
      };

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore,
        boardAfter,
        acceptedMoves: [
          { playerId: PLAYER_B, fromX: 0, fromY: 0, toX: 5, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        priorScoredWordsByPlayer,
      });

      const hesturB = result.playerBWords.find((w) => w.word === "hestur");
      expect(hesturB).toBeDefined();
      expect(hesturB!.isDuplicate).toBe(false);
      expect(hesturB!.totalPoints).toBeGreaterThan(0);
    });

    test("combo bonus excludes duplicate words (duplicate words score 0, not counted for combo)", async () => {
      const { boardBefore, boardAfter } = makeHesturSetup();
      const priorScoredWordsByPlayer: Record<string, Set<string>> = {
        [PLAYER_A]: new Set(["hestur"]),
      };

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore,
        boardAfter,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        priorScoredWordsByPlayer,
      });

      const hestur = result.playerAWords.find((w) => w.word === "hestur");
      expect(hestur).toBeDefined();
      expect(hestur!.isDuplicate).toBe(true);
      expect(hestur!.totalPoints).toBe(0);
      const newCount = result.playerAWords.filter((w) => !w.isDuplicate).length;
      expect(result.comboBonus.playerA).toBe(calculateComboBonus(newCount));
    });
  });

  describe("zero accepted moves round (T044, FR-006d)", () => {
    test("should return RoundScoreResult with zero deltas when acceptedMoves is empty", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [], // No accepted moves
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.deltas).toEqual({ playerA: 0, playerB: 0 });
    });

    test("should return empty word arrays when acceptedMoves is empty", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.playerAWords).toEqual([]);
      expect(result.playerBWords).toEqual([]);
    });

    test("should return zero combo bonuses when acceptedMoves is empty", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.comboBonus).toEqual({ playerA: 0, playerB: 0 });
    });

    test("should return empty frozen tiles when acceptedMoves is empty", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Should return empty frozen tiles (no new tiles frozen)
      expect(result.newFrozenTiles).toEqual({});
    });

    test("should not invoke detectNewWords when acceptedMoves is empty (performance optimization)", async () => {
      const board = emptyBoard();

      // Spy on detectNewWords to verify it's not called
      const deltaSpy = vi.spyOn(deltaDetector, "detectNewWords");

      await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Verify detectNewWords was NOT called (short-circuit optimization)
      expect(deltaSpy).not.toHaveBeenCalled();

      // Clean up spy
      vi.restoreAllMocks();
    });

    test("should still measure duration even with zero accepted moves", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("board unchanged short-circuit (T045, FR-006e)", () => {
    test("should return zero deltas when board is unchanged", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board, // Identical to boardBefore
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.deltas).toEqual({ playerA: 0, playerB: 0 });
    });

    test("should return empty word arrays when board is unchanged", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.playerAWords).toEqual([]);
      expect(result.playerBWords).toEqual([]);
    });

    test("should not invoke detectNewWords when board is unchanged (performance optimization)", async () => {
      const board = emptyBoard();

      // Spy on detectNewWords to verify it's not called
      const deltaSpy = vi.spyOn(deltaDetector, "detectNewWords");

      await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Verify detectNewWords was NOT called (short-circuit optimization)
      expect(deltaSpy).not.toHaveBeenCalled();

      // Clean up spy
      vi.restoreAllMocks();
    });

    test("should not invoke freezeTiles when board is unchanged", async () => {
      const board = emptyBoard();

      // Spy on freezeTiles to verify it's not called
      const freezeSpy = vi.spyOn(frozenTiles, "freezeTiles");

      await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Verify freezeTiles was NOT called
      expect(freezeSpy).not.toHaveBeenCalled();

      // Clean up spy
      vi.restoreAllMocks();
    });

    test("should still measure duration even when board is unchanged", async () => {
      const board = emptyBoard();

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board,
        boardAfter: board,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 1, toY: 0 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test("should detect board difference correctly (deep comparison)", async () => {
      const board1 = emptyBoard("a");
      const board2 = emptyBoard("a");
      board2[5][5] = "b"; // One tile different

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore: board1,
        boardAfter: board2,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 5, fromY: 5, toX: 6, toY: 5 },
        ],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // Since boards are different, pipeline should run
      // This test verifies the comparison is working correctly
      expect(result).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("partial letter scoring (opponent-frozen tiles)", () => {
    test("scores only own tiles' letter points when word spans opponent-frozen tiles", async () => {
      // Player B forms "abcdef" where cols 3-5 ("def") are frozen by player_a.
      // Expected: lettersPoints = value of "abc" only, lengthBonus = (6-2)*5 = 20.
      const boardBefore = emptyBoard();
      const boardAfter = emptyBoard();
      boardAfter[0][0] = "a"; boardAfter[0][1] = "b"; boardAfter[0][2] = "c";
      boardAfter[0][3] = "d"; boardAfter[0][4] = "e"; boardAfter[0][5] = "f";

      const frozenMap: FrozenTileMap = {
        "3,0": { owner: "player_a" },
        "4,0": { owner: "player_a" },
        "5,0": { owner: "player_a" },
      };

      // Mock detectNewWords to return an attributed word with opponentFrozenKeys set
      const spy = vi.spyOn(deltaDetector, "detectNewWords").mockReturnValueOnce([
        {
          text: "abcdef",
          displayText: "abcdef",
          direction: "right" as const,
          start: { x: 0, y: 0 },
          length: 6,
          tiles: [
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
            { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
          ],
          playerId: PLAYER_B,
          opponentFrozenKeys: new Set(["3,0", "4,0", "5,0"]),
        },
      ]);

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore,
        boardAfter,
        acceptedMoves: [{ playerId: PLAYER_B, fromX: 0, fromY: 0, toX: 2, toY: 0 }],
        frozenTiles: frozenMap,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      spy.mockRestore();

      const word = result.playerBWords.find((w) => w.word === "abcdef");
      expect(word).toBeDefined();
      // Letter points only for own tiles "abc" (positions 0-2)
      const { calculateLetterPoints } = await import("@/lib/game-engine/scorer");
      const expectedLetters = calculateLetterPoints("abc");
      expect(word!.lettersPoints).toBe(expectedLetters);
      // Length bonus for full 6-letter word
      expect(word!.lengthBonus).toBe(20);
      expect(word!.totalPoints).toBe(expectedLetters + 20);
    });

    test("scores all tiles when no opponent-frozen tiles are present", async () => {
      // Sanity check: empty opponentFrozenKeys → full letter points as before.
      const boardBefore = emptyBoard();
      const boardAfter = emptyBoard();
      boardAfter[0][0] = "a"; boardAfter[0][1] = "b"; boardAfter[0][2] = "c";

      const spy = vi.spyOn(deltaDetector, "detectNewWords").mockReturnValueOnce([
        {
          text: "abc",
          displayText: "abc",
          direction: "right" as const,
          start: { x: 0, y: 0 },
          length: 3,
          tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
          playerId: PLAYER_A,
          opponentFrozenKeys: new Set<string>(),
        },
      ]);

      const result = await processRoundScoring({
        matchId: MATCH_ID,
        roundId: ROUND_ID,
        boardBefore,
        boardAfter,
        acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 2, toY: 0 }],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      spy.mockRestore();

      const word = result.playerAWords.find((w) => w.word === "abc");
      expect(word).toBeDefined();
      const { calculateLetterPoints } = await import("@/lib/game-engine/scorer");
      expect(word!.lettersPoints).toBe(calculateLetterPoints("abc"));
      expect(word!.lengthBonus).toBe(5); // (3-2)*5
    });
  });
});
