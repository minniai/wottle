import { describe, expect, test, beforeAll } from "vitest";

import { detectNewWords } from "@/lib/game-engine/deltaDetector";
import { loadDictionary } from "@/lib/game-engine/dictionary";
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
const EMPTY_FROZEN: FrozenTileMap = {};

describe("deltaDetector", () => {
  let dict: Set<string>;

  beforeAll(async () => {
    dict = await loadDictionary();
  });

  test("should detect a new word formed by Player A's swap", () => {
    // Player A swaps (0,0) with (5,0) → row 0 becomes "hestur..."
    let boardBefore = emptyBoard();
    boardBefore[0][0] = "r";
    boardBefore[0][1] = "e";
    boardBefore[0][2] = "s";
    boardBefore[0][3] = "t";
    boardBefore[0][4] = "u";
    boardBefore[0][5] = "h";

    const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
    boardAfter[0][0] = "h";
    boardAfter[0][5] = "r";

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: dict,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const hestur = result.find((w) => w.text === "hestur");
    expect(hestur).toBeDefined();
    expect(hestur!.playerId).toBe(PLAYER_A);
  });

  test("should ignore pre-existing words on board_before", () => {
    // "hestur" already exists on both boards
    const boardBefore = placeHorizontal(emptyBoard(), "hestur", 0, 0);
    const boardAfter = placeHorizontal(emptyBoard(), "hestur", 0, 0);

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: dict,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 8, fromY: 8, toX: 9, toY: 9 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    // "hestur" was pre-existing, should not be in result
    const hestur = result.find(
      (w) => w.text === "hestur" && w.start.x === 0 && w.start.y === 0,
    );
    expect(hestur).toBeUndefined();
  });

  test("should return empty when no new words are formed", () => {
    const board = emptyBoard();

    const result = detectNewWords({
      boardBefore: board,
      boardAfter: board,
      dictionary: dict,
      acceptedMoves: [],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    expect(result).toHaveLength(0);
  });

  test("should attribute words to Player B when formed by Player B's swap", () => {
    const boardBefore = emptyBoard();
    // Player A's swap doesn't form words. Player B's swap forms "land".
    // Simulate: boardBefore → Player A swap (no effect) → Player B swap creates "land"
    const boardAfterA = emptyBoard(); // same as before (A's swap is irrelevant)
    const boardAfter = placeHorizontal(emptyBoard(), "land", 0, 0);

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: dict,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 8, fromY: 8, toX: 9, toY: 8 },
        { playerId: PLAYER_B, fromX: 0, fromY: 0, toX: 3, toY: 0 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const land = result.find((w) => w.text === "land");
    expect(land).toBeDefined();
    expect(land!.playerId).toBe(PLAYER_B);
  });

  test("should handle both players forming words in same round", () => {
    const boardBefore = emptyBoard();
    // After Player A's swap: "hestur" at row 0
    // After Player B's swap: "land" at row 2
    // Build boardAfter with both words
    let boardAfter = placeHorizontal(emptyBoard(), "hestur", 0, 0);
    boardAfter = placeHorizontal(boardAfter, "land", 0, 2);

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: dict,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 5, toY: 0 },
        { playerId: PLAYER_B, fromX: 0, fromY: 2, toX: 3, toY: 2 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const hestur = result.find((w) => w.text === "hestur");
    const land = result.find((w) => w.text === "land");

    expect(hestur).toBeDefined();
    expect(land).toBeDefined();
  });
});
