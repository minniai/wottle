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

  test("should reject Player B word when it creates an invalid same-round cross-word junction with Player A's word", () => {
    // Synthetic 3-letter words; "bb" intentionally absent from dict.
    //
    // boardBefore row 0: c(0,0) b(1,0) a(2,0)  →  "cba" not in dict → no baseline word
    // boardBefore row 1: a(1,1) c(2,1) b(3,1)  →  "acb" not in dict → no baseline word
    //
    // Player A swaps (0,0)↔(2,0): row 0 → a(0) b(1) c(2)  → "abc" detected ✓
    // Player B swaps (1,1)↔(3,1): row 1 → b(1) c(2) a(3)  → "bca" detected
    //
    // b at (1,0) from Player A's "abc" sits directly above b at (1,1) from "bca".
    // Vertical cross-sequence = "bb", which is not in the dictionary.
    // Therefore "bca" must be rejected even though no frozen tiles are involved.
    const customDict = new Set(["abc", "bca"]);

    const boardBefore = emptyBoard();
    boardBefore[0][0] = "c";
    boardBefore[0][1] = "b";
    boardBefore[0][2] = "a";
    boardBefore[1][1] = "a";
    boardBefore[1][2] = "c";
    boardBefore[1][3] = "b";

    const boardAfter = emptyBoard();
    boardAfter[0][0] = "a";
    boardAfter[0][1] = "b";
    boardAfter[0][2] = "c";
    boardAfter[1][1] = "b";
    boardAfter[1][2] = "c";
    boardAfter[1][3] = "a";

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: customDict,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 2, toY: 0 },
        { playerId: PLAYER_B, fromX: 1, fromY: 1, toX: 3, toY: 1 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const abc = result.find((w) => w.text === "abc");
    const bca = result.find((w) => w.text === "bca");

    expect(abc).toBeDefined();
    expect(abc!.playerId).toBe(PLAYER_A);

    // "bca" must be rejected: b(1,0) from Player A's "abc" sits directly above
    // b(1,1) from "bca", forming vertical "bb" which is not in the dictionary.
    expect(bca).toBeUndefined();
  });

  test("should only score the longest word when a shorter word is a strict sub-word", () => {
    // dict: "abc" and "abcd" both valid; "abcd" supersedes "abc".
    //
    // boardBefore row 0: d(0,0) b(1,0) c(2,0) a(3,0)  →  "dbca" not in dict → no baseline
    // Player A swaps (0,0)↔(3,0): row 0 → a b c d
    //   Scanner finds both "abc" (start 0, len 3) and "abcd" (start 0, len 4).
    //   "abc" is a strict sub-word of "abcd" → only "abcd" must be credited.
    const customDict = new Set(["abc", "abcd"]);

    const boardBefore = emptyBoard();
    boardBefore[0][0] = "d";
    boardBefore[0][1] = "b";
    boardBefore[0][2] = "c";
    boardBefore[0][3] = "a";

    const boardAfter = emptyBoard();
    boardAfter[0][0] = "a";
    boardAfter[0][1] = "b";
    boardAfter[0][2] = "c";
    boardAfter[0][3] = "d";

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: customDict,
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 3, toY: 0 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const abcd = result.find((w) => w.text === "abcd");
    const abc = result.find((w) => w.text === "abc");

    expect(abcd).toBeDefined();
    expect(abcd!.playerId).toBe(PLAYER_A);
    // "abc" tiles are fully contained within "abcd" — must be suppressed
    expect(abc).toBeUndefined();
  });

  test("should reject both same-player same-round words when they form invalid adjacent cross-words with each other", () => {
    // Two adjacent vertical words from Player B in the same round.
    // "abc" at column 0 and "def" at column 1 create horizontal sequences
    // "ad", "be", "cf" (none in dict) between every row → both must be rejected.
    //
    // Before the fix, neither word's tiles counted as "established" for the
    // other's cross-word check, so both words scored incorrectly.
    const customDict = new Set(["abc", "def"]);

    const boardBefore = emptyBoard();
    const boardAfter = emptyBoard();
    // column 0: a(0,0) b(0,1) c(0,2)
    boardAfter[0][0] = "a";
    boardAfter[1][0] = "b";
    boardAfter[2][0] = "c";
    // column 1: d(1,0) e(1,1) f(1,2)
    boardAfter[0][1] = "d";
    boardAfter[1][1] = "e";
    boardAfter[2][1] = "f";

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: customDict,
      // Dummy moves so both scans differ; the words appear only in boardAfter
      acceptedMoves: [
        { playerId: PLAYER_A, fromX: 8, fromY: 8, toX: 9, toY: 8 },
        { playerId: PLAYER_B, fromX: 8, fromY: 9, toX: 9, toY: 9 },
      ],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    // Adjacent cross-words "ad", "be", "cf" are invalid → neither word should score
    expect(result.find((w) => w.text === "abc")).toBeUndefined();
    expect(result.find((w) => w.text === "def")).toBeUndefined();
  });

  describe("inline extension validation", () => {
    test("T030: rejects new word that extends forward into frozen tiles forming an invalid sequence", () => {
      // Simulates TÚR/VOL: "abc" at cols 0-2 extends right into frozen "def" at cols 3-5
      // → extended sequence "abcdef" is not in dict → "abc" must be rejected
      const customDict = new Set(["abc", "def"]);

      const boardBefore = emptyBoard();
      boardBefore[0][0] = "c"; boardBefore[0][1] = "b"; boardBefore[0][2] = "a";
      boardBefore[0][3] = "d"; boardBefore[0][4] = "e"; boardBefore[0][5] = "f";

      const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
      boardAfter[0][0] = "a"; boardAfter[0][2] = "c"; // Player A swaps (0,0) ↔ (2,0)

      const frozenTiles: FrozenTileMap = {
        "3,0": { owner: "player_b" },
        "4,0": { owner: "player_b" },
        "5,0": { owner: "player_b" },
      };

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 2, toY: 0 },
        ],
        frozenTiles,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // "abc" + frozen "def" = "abcdef" → NOT in dict → inline extension violation → rejected
      expect(result.find((w) => w.text === "abc")).toBeUndefined();
    });

    test("T031: rejects new word that extends backward into frozen tiles forming an invalid sequence", () => {
      // Simulates DÚS/SÓLA: frozen "abc" at cols 0-2, new "def" at cols 3-5
      // → extended sequence "abcdef" (backward extension) is not in dict → "def" must be rejected
      const customDict = new Set(["abc", "def"]);

      const boardBefore = emptyBoard();
      boardBefore[0][0] = "a"; boardBefore[0][1] = "b"; boardBefore[0][2] = "c";
      boardBefore[0][3] = "f"; boardBefore[0][4] = "e"; boardBefore[0][5] = "d";

      const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
      boardAfter[0][3] = "d"; boardAfter[0][5] = "f"; // Player A swaps (3,0) ↔ (5,0)

      const frozenTiles: FrozenTileMap = {
        "0,0": { owner: "player_b" },
        "1,0": { owner: "player_b" },
        "2,0": { owner: "player_b" },
      };

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 3, fromY: 0, toX: 5, toY: 0 },
        ],
        frozenTiles,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // frozen "abc" + "def" = "abcdef" → NOT in dict → inline extension violation → rejected
      expect(result.find((w) => w.text === "def")).toBeUndefined();
    });

    test("T032: accepts word when inline extension through frozen tiles forms a valid sequence", () => {
      // Same forward-extension setup as T030 but "abcdef" IS in the dictionary.
      // The scanner finds both "abc" (cols 0-2) and "abcdef" (cols 0-5).
      // "abc" is suppressed as a subword of "abcdef", so only "abcdef" scores.
      // "abcdef" contains opponent-frozen tiles (cols 3-5) so opponentFrozenKeys is populated.
      const customDict = new Set(["abc", "def", "abcdef"]);

      const boardBefore = emptyBoard();
      boardBefore[0][0] = "c"; boardBefore[0][1] = "b"; boardBefore[0][2] = "a";
      boardBefore[0][3] = "d"; boardBefore[0][4] = "e"; boardBefore[0][5] = "f";

      const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
      boardAfter[0][0] = "a"; boardAfter[0][2] = "c"; // Player A swaps (0,0) ↔ (2,0)

      const frozenTiles: FrozenTileMap = {
        "3,0": { owner: "player_b" },
        "4,0": { owner: "player_b" },
        "5,0": { owner: "player_b" },
      };

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 2, toY: 0 },
        ],
        frozenTiles,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // "abcdef" scores (not rejected for containing opponent tiles)
      const scored = result.find((w) => w.text === "abcdef");
      expect(scored).toBeDefined();
      // Opponent-frozen keys cover the "def" portion (cols 3-5)
      expect(scored!.opponentFrozenKeys).toEqual(new Set(["3,0", "4,0", "5,0"]));
      // "abc" is suppressed as a strict subword of "abcdef"
      expect(result.find((w) => w.text === "abc")).toBeUndefined();
    });

    test("T034: scores word that contains opponent-frozen tiles (no longer rejected)", () => {
      // Player B places tiles to create "abcdef" where "abc" (cols 0-2) are
      // frozen by player_a. The word is valid → Player B should score with
      // opponentFrozenKeys covering the "abc" portion.
      const customDict = new Set(["abcdef", "def"]);

      const boardBefore = emptyBoard();
      // Before: "abc" already on board (frozen), "fed" at cols 3-5 (wrong order)
      boardBefore[0][0] = "a"; boardBefore[0][1] = "b"; boardBefore[0][2] = "c";
      boardBefore[0][3] = "f"; boardBefore[0][4] = "e"; boardBefore[0][5] = "d";

      const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
      boardAfter[0][3] = "d"; boardAfter[0][5] = "f"; // Player B swaps (3,0) ↔ (5,0)

      const frozenTiles: FrozenTileMap = {
        "0,0": { owner: "player_a" },
        "1,0": { owner: "player_a" },
        "2,0": { owner: "player_a" },
      };

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [
          { playerId: PLAYER_B, fromX: 3, fromY: 0, toX: 5, toY: 0 },
        ],
        frozenTiles,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // "abcdef" must now score (no longer rejected for containing opponent tiles)
      const scored = result.find((w) => w.text === "abcdef");
      expect(scored).toBeDefined();
      expect(scored!.playerId).toBe(PLAYER_B);
      // opponentFrozenKeys covers the "abc" portion (cols 0-2, frozen by player_a)
      expect(scored!.opponentFrozenKeys).toEqual(new Set(["0,0", "1,0", "2,0"]));
    });

    test("T033: rejects new vertical word that extends downward into frozen tiles forming an invalid sequence", () => {
      // Vertical analog: "abc" (down) at col 0 rows 0-2, frozen "def" (down) at col 0 rows 3-5
      // → extended sequence "abcdef" is not in dict → "abc" must be rejected
      const customDict = new Set(["abc", "def"]);

      const boardBefore = emptyBoard();
      boardBefore[0][0] = "c"; boardBefore[1][0] = "b"; boardBefore[2][0] = "a";
      boardBefore[3][0] = "d"; boardBefore[4][0] = "e"; boardBefore[5][0] = "f";

      const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
      boardAfter[0][0] = "a"; boardAfter[2][0] = "c"; // Player A swaps (0,0) ↔ (0,2)

      const frozenTiles: FrozenTileMap = {
        "0,3": { owner: "player_b" },
        "0,4": { owner: "player_b" },
        "0,5": { owner: "player_b" },
      };

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [
          { playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 0, toY: 2 },
        ],
        frozenTiles,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      // "abc" (down) extends into frozen "def" (down) → "abcdef" not in dict → rejected
      expect(result.find((w) => w.text === "abc" && w.direction === "down")).toBeUndefined();
    });
  });

  describe("bidirectional scoring (left and up directions)", () => {
    test("T035: detects and scores a new word read right-to-left (left direction)", () => {
      // Player A swaps (0,0)↔(2,0): c,a,t → t,a,c
      // boardBefore has "cat" in right direction; after swap the same tiles read "cat" in left direction.
      // Only "cat" is in the custom dict (not "tac"), so only the new "left" direction word scores.
      const customDict = new Set(["cat"]);

      const boardBefore = emptyBoard();
      boardBefore[0][0] = "c";
      boardBefore[0][1] = "a";
      boardBefore[0][2] = "t";
      const boardAfter = emptyBoard();
      boardAfter[0][0] = "t";
      boardAfter[0][1] = "a";
      boardAfter[0][2] = "c";

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 2, toY: 0 }],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      const cat = result.find((w) => w.text === "cat" && w.direction === "left");
      expect(cat).toBeDefined();
      expect(cat!.playerId).toBe(PLAYER_A);
      // "tac" (left-to-right reading) should NOT score since "tac" is not in dict
      expect(result.find((w) => w.text === "tac")).toBeUndefined();
    });

    test("T036: detects and scores a new word read bottom-to-top (up direction)", () => {
      // Player A swaps (0,0)↔(0,2): col reads c,a,t top-to-bottom → t,a,c top-to-bottom
      // boardBefore has "cat" in down direction; after swap the same tiles read "cat" in up direction.
      // Only "cat" is in the custom dict (not "tac"), so only the new "up" direction word scores.
      const customDict = new Set(["cat"]);

      const boardBefore = emptyBoard();
      boardBefore[0][0] = "c";
      boardBefore[1][0] = "a";
      boardBefore[2][0] = "t";
      const boardAfter = emptyBoard();
      boardAfter[0][0] = "t";
      boardAfter[1][0] = "a";
      boardAfter[2][0] = "c";

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 0, toY: 2 }],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      const cat = result.find((w) => w.text === "cat" && w.direction === "up");
      expect(cat).toBeDefined();
      expect(cat!.playerId).toBe(PLAYER_A);
      // "tac" (top-to-bottom reading) should NOT score since "tac" is not in dict
      expect(result.find((w) => w.text === "tac")).toBeUndefined();
    });

    test("T037: suppresses shorter left-direction subword when longer left-direction word supersedes it", () => {
      // Board: t,a,c,d at x=0,1,2,3 → "left" scan finds "cat" at start (2,0) and "dcat" at start (3,0)
      // "dcat" supersedes "cat" → only "dcat" scores
      const customDict = new Set(["cat", "dcat"]);

      const boardBefore = emptyBoard();
      const boardAfter = emptyBoard();
      boardAfter[0][0] = "t";
      boardAfter[0][1] = "a";
      boardAfter[0][2] = "c";
      boardAfter[0][3] = "d";

      const result = detectNewWords({
        boardBefore,
        boardAfter,
        dictionary: customDict,
        acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 3, toY: 0 }],
        frozenTiles: EMPTY_FROZEN,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
      });

      const dcat = result.find((w) => w.text === "dcat" && w.direction === "left");
      expect(dcat).toBeDefined();
      // "cat" is a strict subword of "dcat" in the "left" direction → suppressed
      expect(result.find((w) => w.text === "cat" && w.direction === "left")).toBeUndefined();
    });
  });

  test("T038: suppresses suffix-overlap word when union span is not a valid dictionary word", () => {
    // boardBefore col 0: k(y=0) l(y=1) a(y=2) x(y=3) a(y=4) s(y=5)
    // Player A swaps (0,3)↔(0,5): col 0 becomes k l a s a x
    // → "klasa" (y=0..4) and "sax" (y=3..5) both found after swap.
    // Neither is a strict subword of the other; union "klasax" ∉ dict.
    // Only "klasa" (earlier start) should score; "sax" must be suppressed.
    const customDict = new Set(["klasa", "sax"]);

    const boardBefore = emptyBoard();
    boardBefore[0][0] = "k";
    boardBefore[1][0] = "l";
    boardBefore[2][0] = "a";
    boardBefore[3][0] = "x";
    boardBefore[4][0] = "a";
    boardBefore[5][0] = "s";

    const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
    boardAfter[3][0] = "s";
    boardAfter[5][0] = "x";

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: customDict,
      acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 3, toX: 0, toY: 5 }],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const klasa = result.find((w) => w.text === "klasa" && w.direction === "down");
    const sax = result.find((w) => w.text === "sax" && w.direction === "down");

    expect(klasa).toBeDefined();
    expect(klasa!.playerId).toBe(PLAYER_A);
    // "sax" shares tiles with "klasa"; union "klasax" ∉ dict → "sax" suppressed
    expect(sax).toBeUndefined();
  });

  test("T039: suppresses opposite-direction word when same-row union span is not a valid dictionary word", () => {
    // boardBefore row 0: e(x=0) b(x=1) c(x=2) d(x=3) a(x=4)
    // Player A swaps (0,0)↔(4,0): row 0 becomes a b c d e
    // → "abc" (right, x=0..2) and "edc" (left, x=4→3→2) both found after swap.
    // They share tile c at (2,0). Union "abcde" ∉ dict.
    // "edc" left (min_x=2 > 0) must be suppressed; only "abc" right scores.
    const customDict = new Set(["abc", "edc"]);

    const boardBefore = emptyBoard();
    boardBefore[0][0] = "e";
    boardBefore[0][1] = "b";
    boardBefore[0][2] = "c";
    boardBefore[0][3] = "d";
    boardBefore[0][4] = "a";

    const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
    boardAfter[0][0] = "a";
    boardAfter[0][4] = "e";

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: customDict,
      acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 0, toX: 4, toY: 0 }],
      frozenTiles: EMPTY_FROZEN,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    const abc = result.find((w) => w.text === "abc" && w.direction === "right");
    const edc = result.find((w) => w.text === "edc" && w.direction === "left");

    expect(abc).toBeDefined();
    expect(abc!.playerId).toBe(PLAYER_A);
    // "edc" shares tile c at (2,0) with "abc"; union "abcde" ∉ dict → "edc" suppressed
    expect(edc).toBeUndefined();
  });

  test("T040: scores valid word when adjacent frozen tiles from a prior round would form an invalid cross-word", () => {
    // "abc" (down) at column 0 rows 0-2 is newly formed by Player A's swap.
    // A frozen tile "d" at (1,1) sits immediately to the right of "b" at (0,1),
    // left over from an unrelated prior-round horizontal word.
    // Cross-sequence "bd" ∉ dict, but this should NOT reject "abc" — frozen tiles
    // from prior unrelated words are not cross-word junctions for the new word.
    const customDict = new Set(["abc"]);

    const boardBefore = emptyBoard();
    boardBefore[0][0] = "a";
    boardBefore[1][0] = "x"; // x ↔ b swap creates "abc" at col 0
    boardBefore[2][0] = "c";
    boardBefore[1][5] = "b"; // b is swapped to (0,1)
    boardBefore[1][1] = "d"; // frozen from prior round — unrelated to "abc"

    const boardAfter = boardBefore.map((row) => [...row]) as BoardGrid;
    boardAfter[1][0] = "b";
    boardAfter[1][5] = "x";

    const frozenTiles: FrozenTileMap = {
      "1,1": { owner: "player_b" },
    };

    const result = detectNewWords({
      boardBefore,
      boardAfter,
      dictionary: customDict,
      acceptedMoves: [{ playerId: PLAYER_A, fromX: 0, fromY: 1, toX: 5, toY: 1 }],
      frozenTiles,
      playerAId: PLAYER_A,
      playerBId: PLAYER_B,
    });

    // "abc" must score: the adjacent frozen tile "d" is from an unrelated prior-round word
    // and must not be treated as a cross-word junction blocking the new word.
    const abc = result.find((w) => w.text === "abc" && w.direction === "down");
    expect(abc).toBeDefined();
    expect(abc!.playerId).toBe(PLAYER_A);
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
