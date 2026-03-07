import { describe, expect, test } from "vitest";

import { selectOptimalCombination } from "@/lib/game-engine/crossValidator";
import type { BoardGrid, BoardWord } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

/** Create a 10x10 board filled with a single letter (no valid words). */
function emptyBoard(fill = "z"): BoardGrid {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => fill),
  ) as BoardGrid;
}

/** Build a horizontal BoardWord for testing. */
function hWord(
  text: string,
  startX: number,
  startY: number,
): BoardWord {
  const tiles = Array.from({ length: text.length }, (_, i) => ({
    x: startX + i,
    y: startY,
  }));
  return {
    text: text.toLowerCase(),
    displayText: text,
    direction: "right",
    start: { x: startX, y: startY },
    length: text.length,
    tiles,
  };
}

/** Build a horizontal-left BoardWord for testing (read right-to-left). */
function hWordLeft(
  text: string,
  startX: number,
  startY: number,
): BoardWord {
  const tiles = Array.from({ length: text.length }, (_, i) => ({
    x: startX - i,
    y: startY,
  }));
  return {
    text: text.toLowerCase(),
    displayText: text,
    direction: "left",
    start: { x: startX, y: startY },
    length: text.length,
    tiles,
  };
}

/** Build a vertical BoardWord for testing. */
function vWord(
  text: string,
  startX: number,
  startY: number,
): BoardWord {
  const tiles = Array.from({ length: text.length }, (_, i) => ({
    x: startX,
    y: startY + i,
  }));
  return {
    text: text.toLowerCase(),
    displayText: text,
    direction: "down",
    start: { x: startX, y: startY },
    length: text.length,
    tiles,
  };
}

/** Place a word on the board horizontally starting at (x,y). */
function placeH(
  board: BoardGrid,
  word: string,
  x: number,
  y: number,
): void {
  for (let i = 0; i < word.length; i++) {
    board[y][x + i] = word[i];
  }
}

/** Place a word on the board vertically starting at (x,y). */
function placeV(
  board: BoardGrid,
  word: string,
  x: number,
  y: number,
): void {
  for (let i = 0; i < word.length; i++) {
    board[y + i][x] = word[i];
  }
}

describe("selectOptimalCombination", () => {
  // Use a small mock dictionary for deterministic tests
  const dict = new Set(["ab", "cd", "abcd", "ef", "gh", "abc", "de"]);

  // T028: Single word passes cross-validation
  test("T028: returns single word when it passes cross-validation against frozen tiles", () => {
    const board = emptyBoard();
    placeH(board, "ab", 0, 0);

    const candidates = [hWord("ab", 0, 0)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("ab");
  });

  // T029: Excludes word that creates invalid cross-word with frozen tile
  test("T029: excludes word that creates invalid cross-word with frozen tile", () => {
    const board = emptyBoard();
    // Place "abc" horizontally at (2,3)
    placeH(board, "abc", 2, 3);
    // Place frozen tiles at (2,4) and (2,5) — adjacent below "a"
    // Cross-word "axq" (3 letters) is not in dictionary → "abc" fails
    board[4][2] = "x";
    board[5][2] = "q";

    const frozenTiles: FrozenTileMap = {
      "2,4": { owner: "player_a" },
      "2,5": { owner: "player_a" },
    };

    const candidates = [hWord("abc", 2, 3)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "abc" excluded: "a" at (2,3) + frozen "x","q" at (2,4),(2,5) = "axq" ∉ dict
    expect(result).toHaveLength(0);
  });

  // T030: Returns empty array when no valid combination exists
  test("T030: returns empty array when no valid combination exists", () => {
    const board = emptyBoard();
    placeH(board, "abc", 0, 0);
    // Frozen tiles below "a" that make an invalid 3-letter cross-word
    board[1][0] = "q";
    board[2][0] = "x";

    const frozenTiles: FrozenTileMap = {
      "0,1": { owner: "player_b" },
      "0,2": { owner: "player_b" },
    };

    const candidates = [hWord("abc", 0, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "aqx" (3 letters) not in dictionary → "abc" fails → empty result
    expect(result).toHaveLength(0);
  });

  // T031: Picks highest-scoring combination when multiple valid subsets exist
  test("T031: picks highest-scoring combination when multiple valid subsets exist", () => {
    const board = emptyBoard();
    // Two horizontal words at different rows, no cross-word interactions
    placeH(board, "ab", 0, 0);
    placeH(board, "abcd", 0, 2);

    const candidates = [
      hWord("ab", 0, 0),   // 2 letters
      hWord("abcd", 0, 2), // 4 letters — higher score
    ];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // Both should pass — the result should include both
    expect(result).toHaveLength(2);
    expect(result.find((w) => w.text === "abcd")).toBeDefined();
    expect(result.find((w) => w.text === "ab")).toBeDefined();
  });

  // T032: Both candidates fail cross-validation individually → empty
  test("T032: handles mutual cross-validation — both fail individually", () => {
    const board3 = emptyBoard();
    // "abc" horizontal at (0,0)-(2,0)
    placeH(board3, "abc", 0, 0);
    // Frozen tiles at (0,1) and (0,2) creating 3-letter cross-word "aqx"
    board3[1][0] = "q";
    board3[2][0] = "x";

    const frozenTiles3: FrozenTileMap = {
      "0,1": { owner: "player_b" },
      "0,2": { owner: "player_b" },
    };

    // Tile (0,0)="a" + frozen "q"(0,1) + frozen "x"(0,2) = "aqx" ∉ dict → fails
    const candidates3 = [hWord("abc", 0, 0)];
    const result3 = selectOptimalCombination(
      candidates3,
      board3,
      frozenTiles3,
      dict,
      "player_a",
    );
    expect(result3).toHaveLength(0);
  });

  // T032b: word A valid alone, but combining with B creates 3-letter cross-word violation
  test("T032b: word A valid alone, but word B tiles create cross-word violation for A", () => {
    const localDict = new Set(["abc", "def"]);
    const board4 = emptyBoard();
    // Word A: "abc" horizontal at (3,3)-(5,3)
    placeH(board4, "abc", 3, 3);
    // Word B: "def" vertical at (3,4)-(3,6)
    placeV(board4, "def", 3, 4);
    // Frozen tile at (3,2)="q" — adjacent above word A's tile (3,3)
    board4[2][3] = "q";

    const frozenTiles4: FrozenTileMap = {
      "3,2": { owner: "player_b" },
    };

    const candidates4 = [hWord("abc", 3, 3), vWord("def", 3, 4)];

    const result4 = selectOptimalCombination(
      candidates4,
      board4,
      frozenTiles4,
      localDict,
      "player_a",
    );

    // A alone: tile (3,3) cross-word = frozen "q"(3,2) + "a"(3,3) = "qa" (2 letters → ignored). Passes.
    // B alone: no established perpendicular neighbors. Passes.
    // {A,B}: tile (3,3) cross = "q"(3,2) + "a"(3,3) + "d"(3,4) + "e"(3,5) + "f"(3,6) = "qadef" ∉ dict → fails.
    // System picks the higher-scoring single word.
    expect(result4).toHaveLength(1);
    expect(["abc", "def"]).toContain(result4[0].text);
  });

  // T033: Prefers superword over subword when both pass cross-validation
  test("T033: prefers superword 'abcd' over subword 'ab' — no same-axis overlap", () => {
    const board = emptyBoard();
    placeH(board, "abcd", 0, 0);

    // "ab" is a subword of "abcd" — both valid in dict
    const candidates = [
      hWord("ab", 0, 0),   // subword
      hWord("abcd", 0, 0), // superword — higher score
    ];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "abcd" and "ab" overlap in the same direction — mutually exclusive.
    // "abcd" scores higher → only "abcd" is returned.
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abcd");
  });

  // T034: Falls back to subword when superword fails cross-validation
  test("T034: falls back to subword 'ab' when superword 'abcd' fails cross-validation", () => {
    const board = emptyBoard();
    placeH(board, "abcd", 0, 0);
    // Frozen tiles below "d" at (3,0): (3,1)="q" and (3,2)="x"
    // Cross-word "dqx" (3 letters) ∉ dict → "abcd" fails
    board[1][3] = "q";
    board[2][3] = "x";
    const frozenTiles: FrozenTileMap = {
      "3,1": { owner: "player_b" },
      "3,2": { owner: "player_b" },
    };

    const candidates = [
      hWord("ab", 0, 0),   // subword — no cross-word issues
      hWord("abcd", 0, 0), // superword — "d" at (3,0) + frozen "q","x" = "dqx" ∉ dict
    ];

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "abcd" fails because of cross-word "dqx" (3 letters).
    // "ab" passes because tiles (0,0) and (1,0) have no 3-letter cross-words.
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("ab");
  });

  // T035: Word with no adjacent scored tiles passes without checks
  test("T035: word with no adjacent frozen tiles passes cross-validation", () => {
    const board = emptyBoard();
    placeH(board, "ab", 5, 5);

    const candidates = [hWord("ab", 5, 5)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("ab");
  });

  // Regression: word through already-frozen tile with pre-existing
  // perpendicular cross-word (e.g., AMA through frozen M where M-I-N-T
  // is already frozen vertically and "MINT" is not in dictionary)
  test("allows word through frozen tile whose perpendicular cross-word is pre-existing", () => {
    const board = emptyBoard();
    // AMA horizontal at row 1: (0,1), (1,1), (2,1)
    placeH(board, "ab", 0, 1); // "ab" at row 1
    // Frozen column at x=1: rows 1-4 with letters that form "bqzz"
    // (1,1)="b" is part of the word AND frozen
    // (1,2)="q", (1,3)="z", (1,4)="z" are frozen below
    board[2][1] = "q";
    board[3][1] = "z";
    board[4][1] = "z";

    const frozenTiles: FrozenTileMap = {
      "1,1": { owner: "player_b" }, // M tile — already frozen
      "1,2": { owner: "player_b" }, // I tile
      "1,3": { owner: "player_b" }, // N tile
      "1,4": { owner: "player_b" }, // T tile
    };

    // "bqzz" vertical is NOT in dict — but it's pre-existing.
    // "ab" should still pass because (1,1) is already frozen
    // and its perpendicular cross-word is unchanged by scoring "ab".
    const candidates = [hWord("ab", 0, 1)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("ab");
  });

  // Regression: overlapping subwords in the same direction are mutually
  // exclusive — only the highest-scoring word should be selected
  test("scores only the superword when many same-direction subwords overlap", () => {
    // Simulates the TOTAÐS bug: scanner finds TOTAÐS, OTAÐS, TOTA, TAÐS, etc.
    // All overlap horizontally → only the highest-scoring one should be picked.
    const longDict = new Set([
      "abcdef",
      "abcde",
      "abcd",
      "bcdef",
      "bcde",
      "bcd",
      "cdef",
      "cde",
      "def",
    ]);
    const board = emptyBoard();
    placeH(board, "abcdef", 0, 0);

    const candidates = [
      hWord("abcdef", 0, 0), // 6 letters — highest score
      hWord("abcde", 0, 0),  // 5 letters
      hWord("abcd", 0, 0),   // 4 letters
      hWord("bcdef", 1, 0),  // 5 letters
      hWord("bcde", 1, 0),   // 4 letters
      hWord("bcd", 1, 0),    // 3 letters
      hWord("cdef", 2, 0),   // 4 letters
      hWord("cde", 2, 0),    // 3 letters
      hWord("def", 3, 0),    // 2 letters
    ];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      longDict,
      "player_a",
    );

    // All words overlap in the same direction → mutually exclusive.
    // "abcdef" (6 letters) scores highest → only it should be returned.
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abcdef");
  });

  // Perpendicular words sharing a crossing tile should BOTH be scored
  test("scores both perpendicular words that share a crossing tile", () => {
    const perpDict = new Set(["abc", "dae"]);
    const board = emptyBoard();
    // "abc" horizontal at (3,3)-(5,3): a(3,3) b(4,3) c(5,3)
    placeH(board, "abc", 3, 3);
    // "dae" vertical at (3,2)-(3,4): d(3,2) a(3,3) e(3,4)
    board[2][3] = "d";
    board[4][3] = "e";

    const candidates = [
      hWord("abc", 3, 3),
      vWord("dae", 3, 2),
    ];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      perpDict,
      "player_a",
    );

    // Perpendicular words sharing one tile → both valid
    expect(result).toHaveLength(2);
  });

  // Non-overlapping same-direction words should both be scored
  test("scores multiple same-direction words that don't overlap", () => {
    const board = emptyBoard();
    placeH(board, "ab", 0, 0);
    placeH(board, "cd", 5, 0); // same row, no overlap

    const candidates = [hWord("ab", 0, 0), hWord("cd", 5, 0)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    expect(result).toHaveLength(2);
  });

  // T036: Adjacent same-direction words on same row — standalone invariant
  test("T036: rejects adjacent same-direction words on same row — keeps higher-scoring", () => {
    const board = emptyBoard();
    placeH(board, "abcde", 0, 0);

    // "abc" at (0,0)-(2,0), "de" at (3,0)-(4,0) — adjacent (col 2 borders col 3)
    const candidates = [hWord("abc", 0, 0), hWord("de", 3, 0)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // Adjacent words violate standalone invariant — only higher-scoring kept
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abc");
  });

  // T037: Adjacent opposite-direction words (right + left) — Issue 2 repro
  test("T037: rejects adjacent right+left words on same row (LÉT+ÆLA pattern)", () => {
    const localDict = new Set(["abc", "fed"]);
    const board = emptyBoard();
    // "abc" right at (0,0)-(2,0), "fed" left at (5,0) reading f(5),e(4),d(3)
    placeH(board, "abcdef", 0, 0);

    const candidates = [
      hWord("abc", 0, 0),         // right: tiles (0,0),(1,0),(2,0)
      hWordLeft("fed", 5, 0),     // left: tiles (5,0),(4,0),(3,0)
    ];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Adjacent: "abc" max_x=2, "fed" min_x=3 → contiguous
    // Only one should be scored
    expect(result).toHaveLength(1);
  });

  // T038: Non-adjacent words on same row should BOTH score
  test("T038: scores both words when gap exists between them on same row", () => {
    const board = emptyBoard();
    placeH(board, "ab", 0, 0);
    placeH(board, "cd", 4, 0); // gap at positions 2,3

    const candidates = [hWord("ab", 0, 0), hWord("cd", 4, 0)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // Gap of 2 tiles between them → not adjacent → both score
    expect(result).toHaveLength(2);
  });

  // T039: Adjacent vertical words should not both score
  test("T039: rejects adjacent vertical words on same column", () => {
    const localDict = new Set(["abc", "de"]);
    const board = emptyBoard();
    placeV(board, "abcde", 0, 0);

    const candidates = [vWord("abc", 0, 0), vWord("de", 0, 3)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Adjacent: "abc" max_y=2, "de" min_y=3 → contiguous
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abc");
  });

  // T040: Rejects word adjacent to frozen tiles on same axis when combined is invalid
  test("T040: rejects word adjacent to frozen tiles on same axis when combined sequence is invalid", () => {
    const localDict = new Set(["uma", "xy"]);
    const board = emptyBoard();
    // "uma" vertically at column 0, rows 0-2
    placeV(board, "uma", 0, 0);
    // Frozen tiles at (0,3) and (0,4) with letters "x","y"
    board[3][0] = "x";
    board[4][0] = "y";

    const frozenTiles: FrozenTileMap = {
      "0,3": { owner: "player_b" },
      "0,4": { owner: "player_b" },
    };

    // "uma" is adjacent to frozen tile (0,3) on the same vertical axis
    // Combined: "uma" + "xy" = "umaxy" ∉ dict → reject "uma"
    const candidates = [vWord("uma", 0, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    expect(result).toHaveLength(0);
  });

  // T041: Allows word adjacent to frozen tiles on same axis when combined IS valid
  test("T041: allows word adjacent to frozen tiles on same axis when combined sequence is valid", () => {
    const localDict = new Set(["ab", "cd", "abcd"]);
    const board = emptyBoard();
    placeH(board, "abcd", 0, 0);

    // Frozen "cd" at (2,0)-(3,0)
    const frozenTiles: FrozenTileMap = {
      "2,0": { owner: "player_b" },
      "3,0": { owner: "player_b" },
    };

    // "ab" at (0,0)-(1,0) is adjacent to frozen "cd" at (2,0)
    // Combined: "ab" + "cd" = "abcd" ∈ dict → accept "ab"
    const candidates = [hWord("ab", 0, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("ab");
  });

  // T042: Word with frozen tiles before it on same axis — combined invalid
  test("T042: rejects word when frozen tiles precede it on same axis with invalid combined", () => {
    const localDict = new Set(["cd", "ab"]);
    const board = emptyBoard();
    placeH(board, "abcd", 0, 0);

    // Frozen "ab" at (0,0)-(1,0)
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,0": { owner: "player_a" },
    };

    // New word "cd" at (2,0)-(3,0) — frozen "ab" immediately before it
    // Combined: "ab" + "cd" = "abcd" — put "abcd" NOT in dict for this test
    const candidates = [hWord("cd", 2, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // "abcd" ∉ localDict → reject "cd"
    expect(result).toHaveLength(0);
  });

  // Additional: empty candidates returns empty result
  test("returns empty array for empty candidates", () => {
    const board = emptyBoard();
    const result = selectOptimalCombination(
      [],
      board,
      {},
      dict,
      "player_a",
    );
    expect(result).toHaveLength(0);
  });

  // Additional: multiple non-conflicting words all pass
  test("includes all words when none conflict with each other", () => {
    const board = emptyBoard();
    // Two words far apart — no cross-word interaction
    placeH(board, "ab", 0, 0);
    placeH(board, "cd", 5, 5);

    const candidates = [hWord("ab", 0, 0), hWord("cd", 5, 5)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    expect(result).toHaveLength(2);
  });
});
