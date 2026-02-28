import { describe, expect, test } from "vitest";
import { extractValidCrossWords } from "@/lib/game-engine/word-finder";
import type { BoardGrid, Coordinate } from "@/lib/types/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

describe("word-finder orthogonal adjacency validation", () => {
  const dictionary = new Set(["cat", "car", "bat", "bot", "tar", "art"]);

  function createBoard(): BoardGrid {
    // Fill with 'x' for rejection tests so it forcefully forms invalid words
    return Array.from({ length: 10 }, () => Array(10).fill("x"));
  }

  test("accepts a swap where both tiles form valid crossing words", () => {
    // For the valid test, the rest of the board should be empty so we only extract the valid words
    const board = Array.from({ length: 10 }, () => Array(10).fill(" "));
    // Swap 1 at (0,0) -> 'c' forms 'cat' horizontally and 'car' vertically
    board[0][0] = "c"; board[0][1] = "a"; board[0][2] = "t";
    board[1][0] = "a"; board[2][0] = "r";

    // Swap 2 at (5,5) -> 'b' forms 'bat' horizontally and 'bot' vertically
    board[5][5] = "b"; board[5][6] = "a"; board[5][7] = "t";
    board[6][5] = "o"; board[7][5] = "t";

    const move = {
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 },
    };

    const result = extractValidCrossWords(board, move, dictionary, DEFAULT_GAME_CONFIG);
    expect(result.isValid).toBe(true);
    expect(result.words.map((w: any) => w.text).sort()).toEqual(["bat", "bot", "car", "cat"]);
  });

  test("rejects if one tile lacks a valid vertical cross", () => {
    const board = createBoard();
    // (0,0) has horizontal 'cat' but vertical is 'cxx' (invalid)
    board[0][0] = "c"; board[0][1] = "a"; board[0][2] = "t";

    // (5,5) has valid crosses
    board[5][5] = "b"; board[5][6] = "a"; board[5][7] = "t";
    board[6][5] = "o"; board[7][5] = "t";

    const move = {
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 },
    };

    const result = extractValidCrossWords(board, move, dictionary, DEFAULT_GAME_CONFIG);
    expect(result.isValid).toBe(false);
  });

  test("rejects if one tile lacks a valid horizontal cross", () => {
    const board = createBoard();
    // 'c' at (0,0) forms 'car' vertically but 'cxx' horizontally
    board[0][0] = "c"; board[1][0] = "a"; board[2][0] = "r";

    // (5,5) has valid crosses
    board[5][5] = "b"; board[5][6] = "a"; board[5][7] = "t";
    board[6][5] = "o"; board[7][5] = "t";

    const move = {
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 },
    };

    const result = extractValidCrossWords(board, move, dictionary, DEFAULT_GAME_CONFIG);
    expect(result.isValid).toBe(false);
  });

  test("T038: accepts a swap where the word is only valid when read right-to-left", () => {
    // Board: t,a,c at x=0,1,2 → horizontal line reads "tac" left-to-right (not in dict)
    // but "cat" right-to-left IS in the dict → swap should be accepted (OR logic)
    const boardOR = Array.from({ length: 10 }, () => Array(10).fill(" ")) as BoardGrid;
    boardOR[0][0] = "t";
    boardOR[0][1] = "a";
    boardOR[0][2] = "c";

    const move = { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } };
    const result = extractValidCrossWords(boardOR, move, dictionary, DEFAULT_GAME_CONFIG);
    // "tac" is not in dict but "cat" (its reverse) is → isValid should be true
    expect(result.isValid).toBe(true);
  });

  test("does not score diagonal placements even if they form words", () => {
    const board = createBoard();
    // 'cat' is spelled diagonally down-right
    board[0][0] = "c"; 
    board[1][1] = "a"; 
    board[2][2] = "t";

    // Assume normal valid crosses at (5,5) for the other tile
    board[5][5] = "b"; board[5][6] = "a"; board[5][7] = "t";
    board[6][5] = "o"; board[7][5] = "t";

    const move = {
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 },
    };

    const result = extractValidCrossWords(board, move, dictionary, DEFAULT_GAME_CONFIG);
    // Since 'cat' is diagonal, the tile at (0,0), (1,1) etc wouldn't have valid orthogonal crosses
    // so the move should be rejected outright.
    expect(result.isValid).toBe(false);
  });
});
