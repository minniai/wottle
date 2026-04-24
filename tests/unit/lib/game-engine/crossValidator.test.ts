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

  // T029b: Rejects word when swapped tile is adjacent to frozen tiles forming an
  // N-letter cross-sequence (N = DEFAULT_GAME_CONFIG.minimumWordLength = 3) that is
  // NOT in the dictionary. For crosses at or above the minimum length, the
  // dictionary check applies; for crosses below the minimum (2-letter), the
  // placement is rejected outright since the sequence cannot satisfy the
  // 3-letter word rule (see T029c).
  test("T029b: rejects word when end tile has ≥-minimum vertical cross-sequence not in dictionary", () => {
    const localDict = new Set(["rám"]); // "myz"/"zym" not in dict
    const board = emptyBoard();
    // "rám" horizontal at row 1: r(5,1) á(6,1) m(7,1)
    board[1][5] = "r";
    board[1][6] = "á";
    board[1][7] = "m";
    // Frozen "y" at (7,2) and "z" at (7,3) — a 2-frozen run below m forms the
    // 3-letter vertical cross "myz" (m + y + z).
    board[2][7] = "y";
    board[3][7] = "z";
    const frozenTiles: FrozenTileMap = {
      "7,2": { owner: "player_b" },
      "7,3": { owner: "player_b" },
    };

    const candidates = [hWord("rám", 5, 1)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // m(7,1) + frozen y(7,2) + frozen z(7,3) = "myz" → not in dictionary →
    // violation → "rám" rejected
    expect(result).toHaveLength(0);
  });

  // T029c: Rejects word when a single frozen tile forms a below-minimum perpendicular
  // cross-sequence — even if the 2-letter combination happens to be in the dictionary.
  // Under DEFAULT_GAME_CONFIG.minimumWordLength = 3, any perpendicular sequence whose
  // length is >= 2 but < 3 is inherently invalid (cannot satisfy the word-length rule).
  // Real-game scenario (screenshot 2026-04-19): placing PÓLA horizontally below SJÁ
  // creates the vertical pair "JP" (and "ÁÓ", "AL", "IA"). None of those are valid
  // 3-letter words because they aren't 3 letters long — PÓLA must be rejected.
  test("T029c: rejects word when a single frozen tile forms a 2-letter perpendicular cross (below 3-letter minimum)", () => {
    const localDict = new Set(["pura", "að"]); // "að" is a valid Icelandic word but length < min
    const board = emptyBoard();
    board[1][2] = "a";
    board[2][2] = "r";
    board[3][2] = "u";
    board[4][2] = "p";
    board[1][3] = "ð"; // Frozen "ð" directly right of a(2,1) — forms 2-letter cross "að"
    const frozenTiles: FrozenTileMap = {
      "3,1": { owner: "player_b" },
    };

    const candidates = [
      {
        text: "pura",
        displayText: "PURA",
        direction: "up" as const,
        start: { x: 2, y: 4 },
        length: 4,
        tiles: [{ x: 2, y: 4 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 2, y: 1 }],
      },
    ];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // a(2,1) + frozen ð(3,1) = 2-letter cross "að" → below minimumWordLength (3)
    // → violation → "pura" rejected regardless of dictionary contents
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

  // T032b: word A rejected by a minimum-length vertical cross with frozen tiles
  // (at DEFAULT_GAME_CONFIG.minimumWordLength = 3).
  test("T032b: word A rejected when frozen run creates an invalid ≥3-letter cross", () => {
    const localDict = new Set(["abc", "de"]);
    const board4 = emptyBoard();
    // Word A: "abc" horizontal at (0,3)-(2,3) — left edge
    placeH(board4, "abc", 0, 3);
    // Word B: "de" vertical at (0,4)-(0,5)
    placeV(board4, "de", 0, 4);
    // Frozen run above word A: "x" at (0,1) + "q" at (0,2) → 3-letter cross
    // "xqa" with a(0,3). Not in dict → violation → "abc" rejected.
    board4[1][0] = "x";
    board4[2][0] = "q";

    const frozenTiles4: FrozenTileMap = {
      "0,1": { owner: "player_b" },
      "0,2": { owner: "player_b" },
    };

    const candidates4 = [hWord("abc", 0, 3), vWord("de", 0, 4)];

    const result4 = selectOptimalCombination(
      candidates4,
      board4,
      frozenTiles4,
      localDict,
      "player_a",
    );

    // A alone: FAILS — frozen run "x,q" + "a" = "xqa" (3 letters) not in dict → violation
    // B alone: passes (no frozen adjacency on vertical axis)
    // Result: only B survives
    expect(result4).toHaveLength(1);
    expect(result4[0].text).toBe("de");
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
    placeH(board, "ab", 0, 5);

    const candidates = [hWord("ab", 0, 5)];
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
    // "abc" horizontal at (0,1)-(2,1) — left edge
    placeH(board, "abc", 0, 1);
    // "dae" vertical at col 0, rows 0-2 — top edge, sharing "a" at (0,1)
    board[0][0] = "d";
    board[2][0] = "e";

    const candidates = [
      hWord("abc", 0, 1),
      vWord("dae", 0, 0),
    ];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      perpDict,
      "player_a",
    );

    // abc: left edge boundary OK. dae: top edge boundary OK.
    // Perpendicular words sharing one tile → both valid
    expect(result).toHaveLength(2);
  });

  // Non-overlapping same-direction words should both be scored
  test("scores multiple same-direction words that don't overlap", () => {
    const board = emptyBoard();
    placeH(board, "ab", 0, 0);  // left edge
    placeH(board, "cd", 8, 0);  // right edge (cols 8-9)

    const candidates = [hWord("ab", 0, 0), hWord("cd", 8, 0)];
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
    placeH(board, "ab", 0, 0);   // left edge
    placeH(board, "cd", 8, 0);   // right edge (cols 8-9), gap at positions 2-7

    const candidates = [hWord("ab", 0, 0), hWord("cd", 8, 0)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // Gap between them, both at edges → both score
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

  // T040: Rejects word adjacent to frozen same-axis dict-word run
  test("T040: rejects word adjacent to a frozen same-axis dict-word run when combined sequence is not a dict word (#200)", () => {
    const localDict = new Set(["uma", "xy"]);
    const board = emptyBoard();
    placeV(board, "uma", 0, 0);
    board[3][0] = "x";
    board[4][0] = "y";

    const frozenTiles: FrozenTileMap = {
      "0,3": { owner: "player_b" },
      "0,4": { owner: "player_b" },
    };

    // Legacy frozen tiles form "xy", itself a dict word → treated as a
    // prior same-axis scored word. Combined "umaxy" is not a dict word
    // → reject (standalone invariant, issue #200).
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

  // T042: Word with frozen tiles before it on same axis — combined not in dict
  test("T042: rejects word when frozen same-axis dict-word precedes it and combined sequence is not a dict word (#200)", () => {
    const localDict = new Set(["cd", "ab"]);
    const board = emptyBoard();
    placeH(board, "abcd", 0, 0);

    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,0": { owner: "player_a" },
    };

    // Frozen "ab" (dict word) extends the new word's same axis.
    // Combined "abcd" is not in the dict → reject.
    const candidates = [hWord("cd", 2, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

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
    // Two words far apart, both at edges — no cross-word interaction
    placeH(board, "ab", 0, 0);   // left+top edge
    placeH(board, "cd", 8, 9);   // right+bottom edge

    const candidates = [hWord("ab", 0, 0), hWord("cd", 8, 9)];
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

  // T043: OPA+TÍS same-round — subset validation rejects pair via cross-word
  test("T043: rejects subset {OPA, TÍS} when perpendicular cross-word OPAT is invalid", () => {
    const localDict = new Set(["opa", "tís"]);
    const board = emptyBoard();
    // OPA vertical at col 1, rows 2-4
    placeV(board, "opa", 1, 2);
    // TÍS horizontal at row 5, cols 1-3 (T at (1,5) is directly below OPA)
    placeH(board, "tís", 1, 5);

    const candidates = [vWord("opa", 1, 2), hWord("tís", 1, 5)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // {OPA, TÍS}: tile (1,5) of TÍS — vertical cross-word = OPA + T = "opat" ∉ dict → rejected
    // Only the higher-scoring single word survives
    expect(result).toHaveLength(1);
  });

  // T044: Word alone passes when adjacent non-frozen tiles don't affect scoring
  test("T044: allows word when adjacent tiles are not frozen (MÖLUN regression fix)", () => {
    const localDict = new Set(["abc"]);
    const board = emptyBoard();
    // Place q-abc-x at row 5 (interior)
    board[5][2] = "q";
    placeH(board, "abc", 3, 5);
    board[5][6] = "x";

    const candidates = [hWord("abc", 3, 5)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Adjacent Q and X are NOT frozen — only frozen sequences matter.
    // ABC itself is valid → accepted (violatesSameAxisBoundary removed)
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abc");
  });

  // T047: Sandwich — word between two frozen runs, full sequence invalid → reject
  test("T047: rejects word sandwiched between frozen same-axis dict-word runs when full combined sequence isn't a dict word (#200)", () => {
    const localDict = new Set(["ab", "cd", "ef", "abcd", "cdef", "bcd"]);
    const board = emptyBoard();
    placeH(board, "abcdef", 0, 0);

    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,0": { owner: "player_a" },
      "4,0": { owner: "player_b" },
      "5,0": { owner: "player_b" },
    };

    // Both sides have dict-word frozen extensions ("ab" and "ef"). The
    // combined "ab" + "cd" is "abcd" (dict) and "cd" + "ef" is "cdef"
    // (dict) individually, but the full sandwich "abcdef" is not a
    // dict word → reject (standalone invariant, issue #200).
    const candidates = [hWord("cd", 2, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    expect(result).toHaveLength(0);
  });

  // T048: Sandwich — full combined sequence IS valid → word accepted
  test("T048: allows sandwiched word when full combined sequence is valid", () => {
    const localDict = new Set(["ab", "cd", "ef", "abcd", "cdef", "bcd", "abcdef"]);
    const board = emptyBoard();
    placeH(board, "abcdef", 0, 0);

    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,0": { owner: "player_a" },
      "4,0": { owner: "player_b" },
      "5,0": { owner: "player_b" },
    };

    const candidates = [hWord("cd", 2, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Full sequence "abcdef" ∈ dict → sandwich OK → "cd" accepted
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("cd");
  });

  // T046: Interior word with non-frozen adjacent tiles — accepted (invariant only
  // applies to frozen tile sequences, not arbitrary board tiles)
  test("T046: allows interior word when adjacent tiles are not frozen", () => {
    const localDict = new Set(["abc"]);
    const board = emptyBoard();
    // Place q-abc-x at row 0
    board[0][2] = "q";
    placeH(board, "abc", 3, 0);
    board[0][6] = "x";

    const candidates = [hWord("abc", 3, 0)];
    const frozenTiles: FrozenTileMap = {};

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Adjacent Q and X are NOT frozen — only frozen sequences matter.
    // ABC itself is valid → accepted
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("abc");
  });

  // ─── T049: Physical Adjacency vs scoredAxes ─────────────────────

  // T049: Rejects horizontal word that extends a prior horizontal-scored
  // frozen tile into a combined run that is not a dict word (issue #200).
  // The tile at (3,0) was scored on the horizontal axis, so placing a new
  // horizontal word adjacent to it concatenates two same-axis scored
  // sequences. The combined "atað" must be a dict word for the
  // placement to be valid; since it is not, "tað" is rejected.
  test("T049: rejects horizontal word that extends a same-axis prior-scored tile into a non-dict combined run (#200)", () => {
    const localDict = new Set(["tað"]);
    const board = emptyBoard();
    board[0][3] = "a";
    placeH(board, "tað", 4, 0);

    const frozenTiles: FrozenTileMap = {
      "3,0": { owner: "player_a", scoredAxes: ["horizontal"] },
    };

    const candidates = [hWord("tað", 4, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_b",
    );

    expect(result).toHaveLength(0);
  });

  test("T049b: ALLOWS horizontal word adjacent to a frozen tile scored only on a perpendicular axis (issue #136)", () => {
    // A frozen tile with scoredAxes=["vertical"] was placed by a vertical
    // word. Horizontally it's an incidental neighbor — placing a new
    // horizontal word next to it does NOT extend any prior horizontal
    // word, so the combined-sequence check should not fire. Previously
    // this rejected the placement and prevented valid 3-letter words
    // (e.g. BÆN, BÁS) from scoring whenever a frozen perpendicular-axis
    // tile happened to sit adjacent. See issue #136.
    const localDict = new Set(["tað"]);
    const board = emptyBoard();
    board[0][3] = "x";
    placeH(board, "tað", 4, 0);

    const frozenTiles: FrozenTileMap = {
      "3,0": { owner: "player_a", scoredAxes: ["vertical"] },
    };

    const candidates = [hWord("tað", 4, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_b",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("tað");
  });

  test("T049c: rejects horizontal word adjacent to multi-axis frozen tile when combined run is not a dict word (#200)", () => {
    const localDict = new Set(["tað"]);
    const board = emptyBoard();
    board[0][3] = "x";
    placeH(board, "tað", 4, 0);

    const frozenTiles: FrozenTileMap = {
      "3,0": { owner: "player_a", scoredAxes: ["horizontal", "vertical"] },
    };

    const candidates = [hWord("tað", 4, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_b",
    );

    // scoredAxes includes "horizontal" → the frozen tile extends a prior
    // horizontal scored run. Combined "xtað" is not a dict word → reject.
    expect(result).toHaveLength(0);
  });

  test("T049d: rejects word adjacent to legacy (no-scoredAxes) frozen tiles whose letters form a dict word when combined run is not (#200)", () => {
    const localDict = new Set(["uma", "xy"]);
    const board = emptyBoard();
    placeV(board, "uma", 0, 0);
    board[3][0] = "x";
    board[4][0] = "y";

    const frozenTiles: FrozenTileMap = {
      "0,3": { owner: "player_b" },
      "0,4": { owner: "player_b" },
    };

    const candidates = [vWord("uma", 0, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Legacy frozen tiles (no scoredAxes) form "xy", itself a dict word
    // → treated as a prior same-axis scored word. Combined "umaxy" is
    // not a dict word → reject (standalone invariant, issue #200).
    expect(result).toHaveLength(0);
  });

  // T050: NÖS regression — under the per-letter rule (issue #195), a
  // new word sitting directly below a frozen single letter is allowed
  // as long as the new word itself covers its letters. The combined
  // run need not be a dict word.
  test("T050: allows vertical word when a single frozen letter above it extends the run but nös itself covers its letters", () => {
    const localDict = new Set(["nös"]);
    const board = emptyBoard();
    board[1][3] = "R";
    board[2][3] = "N";
    board[3][3] = "Ö";
    board[4][3] = "S";

    const frozenTiles: FrozenTileMap = {
      "3,1": { owner: "player_b" },
    };

    const candidates = [vWord("nös", 3, 2)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("nös");
  });

  // T051: NÖS regression — same scenario but combined run IS a valid word → accept
  test("T051: accepts vertical word when frozen letter above it makes a valid combined run", () => {
    // Column x=3: R(frozen, row 1), N(row 2), Ö(row 3), S(row 4)
    // "rnös" is in this test's dictionary → nös should be accepted
    const localDict = new Set(["nös", "rnös"]);
    const board = emptyBoard();
    board[1][3] = "R";
    board[2][3] = "N";
    board[3][3] = "Ö";
    board[4][3] = "S";

    const frozenTiles: FrozenTileMap = {
      "3,1": { owner: "player_b" },
    };

    const candidates = [vWord("nös", 3, 2)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // R(frozen) + NÖS = "rnös" ∈ dict → nös accepted
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("nös");
  });

  // T052: Same-axis frozen letter precedes the new word — under the
  // per-letter rule the new word covers its own letters and the combined
  // run need not be a dict word. Contrived 2-letter candidate; the real
  // scanner would never emit one.
  test("T052: allows horizontal word when a single frozen letter precedes it (per-letter rule)", () => {
    const localDict = new Set(["ab"]);
    const board = emptyBoard();
    board[2][1] = "X";
    board[2][2] = "A";
    board[2][3] = "B";

    const frozenTiles: FrozenTileMap = {
      "1,2": { owner: "player_b" },
    };

    const candidates = [hWord("ab", 2, 2)];
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

  // ─── Issue #200: cross-round same-axis standalone invariant ─────
  //
  // When a new word's endpoint physically abuts a frozen same-axis
  // scored run, the combined sequence must be a dict word — otherwise
  // the board ends up showing concatenations like "ÖRLTEL" (= ÖRL +
  // TEL), "ÞESSINÓK" (= ÞESSI + NÓK), "NEFÞEMA" (= NEF + ÞEMA) that
  // aren't valid words. This is the per-round `hasNoSameAxisConflict`
  // rule extended across rounds.

  test("T053 (#200): rejects vertical word that extends a prior-scored same-axis dict word into a non-dict combined run (ÖRL+TEL=ÖRLTEL)", () => {
    const localDict = new Set(["örl", "tel"]);
    const board = emptyBoard();
    // Prior: ÖRL scored vertically at col 1 rows 1-3
    placeV(board, "örl", 1, 1);
    // New candidate: TEL vertical at col 1 rows 4-6
    placeV(board, "tel", 1, 4);

    const frozenTiles: FrozenTileMap = {
      "1,1": { owner: "player_b", scoredAxes: ["vertical"] },
      "1,2": { owner: "player_b", scoredAxes: ["vertical"] },
      "1,3": { owner: "player_b", scoredAxes: ["vertical"] },
    };

    const candidates = [vWord("tel", 1, 4)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    expect(result).toHaveLength(0);
  });

  test("T054 (#200): rejects vertical word that concatenates with a prior-scored same-axis dict word above it (ÞESSI+NÓK=ÞESSINÓK)", () => {
    const localDict = new Set(["þessi", "nók"]);
    const board = emptyBoard();
    placeV(board, "þessi", 9, 0);
    placeV(board, "nók", 9, 5);

    const frozenTiles: FrozenTileMap = {
      "9,0": { owner: "player_b", scoredAxes: ["vertical"] },
      "9,1": { owner: "player_b", scoredAxes: ["vertical"] },
      "9,2": { owner: "player_b", scoredAxes: ["vertical"] },
      "9,3": { owner: "player_b", scoredAxes: ["vertical"] },
      "9,4": { owner: "player_b", scoredAxes: ["vertical"] },
    };

    const candidates = [vWord("nók", 9, 5)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    expect(result).toHaveLength(0);
  });

  test("T055 (#200): rejects horizontal word that concatenates with a prior-scored same-axis dict word (NEF+ÞEMA=NEFÞEMA)", () => {
    const localDict = new Set(["nef", "þema"]);
    const board = emptyBoard();
    placeH(board, "nef", 1, 9);
    placeH(board, "þema", 4, 9);

    const frozenTiles: FrozenTileMap = {
      "1,9": { owner: "player_a", scoredAxes: ["horizontal"] },
      "2,9": { owner: "player_a", scoredAxes: ["horizontal"] },
      "3,9": { owner: "player_a", scoredAxes: ["horizontal"] },
    };

    const candidates = [hWord("þema", 4, 9)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_b",
    );

    expect(result).toHaveLength(0);
  });

  test("T056 (#200): accepts vertical word when combined run with prior-scored same-axis dict word IS a dict word", () => {
    const localDict = new Set(["nef", "þema", "nefþema"]);
    const board = emptyBoard();
    placeH(board, "nef", 1, 9);
    placeH(board, "þema", 4, 9);

    const frozenTiles: FrozenTileMap = {
      "1,9": { owner: "player_a", scoredAxes: ["horizontal"] },
      "2,9": { owner: "player_a", scoredAxes: ["horizontal"] },
      "3,9": { owner: "player_a", scoredAxes: ["horizontal"] },
    };

    const candidates = [hWord("þema", 4, 9)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_b",
    );

    // Combined "nefþema" is in the dict → accept.
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("þema");
  });

  test("T057 (#136 regression): accepts horizontal word adjacent to a perpendicular-axis-only frozen tile (NMÚL-shape, BÆN-shape)", () => {
    // Frozen N at (5,3) scored only horizontally — does NOT extend the
    // new vertical word MÚL on its own (vertical) axis.
    const localDict = new Set(["múl"]);
    const board = emptyBoard();
    board[3][5] = "n";
    placeV(board, "múl", 5, 4);

    const frozenTiles: FrozenTileMap = {
      "5,3": { owner: "player_a", scoredAxes: ["horizontal"] },
    };

    const candidates = [vWord("múl", 5, 4)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_b",
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("múl");
  });

  test("T058 (#200): rejects candidate sandwiched between two prior same-axis scored words whose combined sequence is not dict", () => {
    const localDict = new Set(["ab", "xy", "tel"]);
    const board = emptyBoard();
    board[2][0] = "a";
    board[2][1] = "b";
    placeH(board, "tel", 2, 2);
    board[2][5] = "x";
    board[2][6] = "y";

    const frozenTiles: FrozenTileMap = {
      "0,2": { owner: "player_b", scoredAxes: ["horizontal"] },
      "1,2": { owner: "player_b", scoredAxes: ["horizontal"] },
      "5,2": { owner: "player_b", scoredAxes: ["horizontal"] },
      "6,2": { owner: "player_b", scoredAxes: ["horizontal"] },
    };

    const candidates = [hWord("tel", 2, 2)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      localDict,
      "player_a",
    );

    // Combined "abtelxy" (or any extended combinations) not in dict → reject.
    expect(result).toHaveLength(0);
  });
});

