import { describe, expect, test, beforeAll } from "vitest";

import { processRoundScoring } from "@/lib/game-engine/wordEngine";
import { calculateComboBonus } from "@/lib/game-engine/scorer";
import { loadDictionary } from "@/lib/game-engine/dictionary";
import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

function emptyBoard(fill = "z"): BoardGrid {
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

  /** Create a board where swapping (0,0) ↔ (0,9) forms "hestur" at row 0. */
  function makeHesturSetup(): {
    boardBefore: BoardGrid;
    boardAfter: BoardGrid;
  } {
    const boardBefore = emptyBoard();
    boardBefore[0][0] = "z";
    boardBefore[0][1] = "e";
    boardBefore[0][2] = "s";
    boardBefore[0][3] = "t";
    boardBefore[0][4] = "u";
    boardBefore[0][5] = "r";
    boardBefore[0][9] = "h";

    const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
    boardAfter[0][0] = "h";
    boardAfter[0][9] = "z";

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
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 9, toY: 0 },
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
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 9, toY: 0 },
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
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 9, toY: 0 },
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
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 9, toY: 0 },
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
          { playerId: PLAYER_B, fromX: 0, fromY: 0, toX: 9, toY: 0 },
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
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 9, toY: 0 },
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
});
