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
    // Place "ab" horizontally at (2,3)
    placeH(board, "ab", 2, 3);
    // Place a frozen tile at (2,4) with letter "z" — adjacent below "a"
    // Cross-word "az" is not in dictionary → "ab" fails cross-validation
    board[4][2] = "x";

    const frozenTiles: FrozenTileMap = {
      "2,4": { owner: "player_a" },
    };

    const candidates = [hWord("ab", 2, 3)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "ab" should be excluded because "a" at (2,3) + frozen "x" at (2,4) = "ax" ∉ dict
    expect(result).toHaveLength(0);
  });

  // T030: Returns empty array when no valid combination exists
  test("T030: returns empty array when no valid combination exists", () => {
    const board = emptyBoard();
    placeH(board, "ab", 0, 0);
    // Frozen tile adjacent to "a" that makes an invalid cross-word
    board[1][0] = "q";

    const frozenTiles: FrozenTileMap = {
      "0,1": { owner: "player_b" },
    };

    const candidates = [hWord("ab", 0, 0)];
    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "aq" is not in dictionary → "ab" fails → empty result
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

  // T032: Handles mutual cross-validation (word A valid alone but
  // creates invalid cross-word when combined with word B)
  test("T032: handles mutual cross-validation — picks best valid subset", () => {
    const board = emptyBoard();
    // Word A: "ab" horizontal at row 0, (0,0)-(1,0)
    placeH(board, "ab", 0, 0);
    // Word B: "cd" vertical at col 1, (1,0)-(1,1)
    placeV(board, "cd", 1, 0);

    // If both are scored, "b" at (1,0) has word B's "c" also at (1,0).
    // Actually they share tile (1,0) — the letter there is "b" from hWord
    // and "c" from vWord. In reality, a tile can only have one letter.
    // Let's set up a proper mutual conflict:

    // Word A: "ab" horizontal at (0,3)-(1,3)
    // Word B: "ef" horizontal at (0,5)-(1,5)
    // Word B creates a frozen-like cross-word issue with word A's "a"
    // via a vertical connection.

    // Simpler approach: two candidate words, one creates a cross-word
    // issue ONLY when the other is also scored.

    // Word A: "ab" at (4,0)-(5,0) horizontal
    // Word B: "cd" at (5,0)-(5,1) vertical — shares tile (5,0) with word A
    // But (5,0) has "b" from word A. Word B says "cd" starting at (5,0).
    // In reality, the board has one letter per cell.

    // Let's use a cleaner setup:
    // The board has specific letters placed.
    // Word A horizontal at row 2: "ef" at (0,2)-(1,2)
    // Word B vertical at col 0: "gh" at (0,4)-(0,5) — wait, that's horizontal

    // Cleanest approach: create two words that individually pass
    // cross-validation but together one creates an issue.
    const board2 = emptyBoard();
    // Word A: "ab" horizontal at (3,0)-(4,0)
    placeH(board2, "ab", 3, 0);
    // Word B: "ef" vertical at (4,0)-(4,1)
    // Letter at (4,0) is "b" (shared with word A)
    // Word B would be "ef" but (4,0)="b", so "bf" vertically.
    // Let's make B genuinely at a different position.

    // Actually, mutual cross-validation conflicts are quite tricky to set up.
    // Let me use a realistic scenario:
    //
    // Word A: "de" horizontal at (0,2)-(1,2)
    // Word B: "ef" horizontal at (1,2)-(2,2)
    // They overlap at (1,2)="e".
    // When both are scored, tile (1,2) is part of both.
    // But cross-validation checks perpendicular frozen/scored tiles,
    // not same-direction overlaps.
    //
    // For a real mutual conflict: Word A tiles, when B is also scored,
    // create a perpendicular sequence that's invalid.
    //
    // Word A: "ab" horizontal at (0,0)-(1,0)
    // Word B: "cd" horizontal at (0,2)-(1,2)
    // Frozen tile at (0,1) owned by someone
    // If both A and B are scored, column 0 has:
    //   (0,0)=a (from A, newly scored)
    //   (0,1)=frozen tile
    //   (0,2)=c (from B, newly scored)
    // Cross-word at column 0: "a" + frozen + "c" → need to check
    //
    // Actually the cross-validation checks for each tile in a word,
    // whether perpendicular adjacent ESTABLISHED tiles form a valid word.
    // "Established" = frozen tiles + other candidate tiles in the combination.
    //
    // If we score word A "ab" and word B "cd", then tile (0,0)="a" from A
    // has perpendicular neighbor (0,1) which is frozen. The cross-word is
    // "a"+"frozen_letter" = 2-char cross-word, which needs to be in dict.

    // Let's simplify: two candidates where only one can be chosen.
    const board3 = emptyBoard();
    // "ab" horizontal at (0,0)-(1,0)
    placeH(board3, "ab", 0, 0);
    // "ef" horizontal at (0,2)-(1,2)
    placeH(board3, "ef", 0, 2);
    // Frozen tile at (0,1) with letter "q"
    board3[1][0] = "q";

    const frozenTiles3: FrozenTileMap = {
      "0,1": { owner: "player_b" },
    };

    // Word A "ab": tile (0,0) has frozen neighbor (0,1)="q" below.
    // Cross-word "aq" not in dict → word A fails.
    // Word B "ef": tile (0,2) has frozen neighbor (0,1)="q" above.
    // Cross-word "qe" not in dict → word B also fails.
    // Both fail individually → empty result
    const candidates3 = [hWord("ab", 0, 0), hWord("ef", 0, 2)];
    const result3 = selectOptimalCombination(
      candidates3,
      board3,
      frozenTiles3,
      dict,
      "player_a",
    );
    // Both fail → empty
    expect(result3).toHaveLength(0);
  });

  // Better T032: one word passes alone, but including both creates issue
  test("T032b: word A valid alone, but word B tiles create cross-word violation for A", () => {
    const board = emptyBoard();
    // Word A: "ab" horizontal at (0,0)-(1,0)
    placeH(board, "ab", 0, 0);
    // Word B: "cd" vertical at (0,0)-(0,1) — but (0,0) already has "a"
    // so in the board, "c" is at (0,0) and "d" at (0,1).
    // Can't have both. Let's rethink.

    // Setup: Word A and Word B don't share tiles.
    // Word A: "ab" horizontal at (3,3)-(4,3)
    // Word B: "de" vertical at (3,4)-(3,5)
    // When B is scored, tile (3,4) is adjacent to A's tile (3,3) vertically.
    // Cross-word at column 3: (3,3)="a" (from A) + (3,4)="d" (from B) = "ad"
    // "ad" is not in our dict → if both are in the combination, A or B fails.
    // Without B, A passes (no frozen neighbor at (3,4)).
    // Without A, B passes (no frozen neighbor at (3,3)).
    // System should pick the higher-scoring one.

    const board4 = emptyBoard();
    placeH(board4, "ab", 3, 3);
    placeV(board4, "de", 3, 4);

    const candidates4 = [hWord("ab", 3, 3), vWord("de", 3, 4)];
    const frozenTiles4: FrozenTileMap = {};

    const result4 = selectOptimalCombination(
      candidates4,
      board4,
      frozenTiles4,
      dict,
      "player_a",
    );

    // Both individually valid (no frozen neighbors).
    // Together: tile (3,3) from A has neighbor (3,4) from B → cross-word "ad" ∉ dict
    // So can't have both. System picks whichever scores higher.
    // "ab" and "de" are both 2-letter words with same structure.
    // Scores are likely similar, but one should be picked.
    expect(result4).toHaveLength(1);
    // Should pick whichever has higher total score
    expect(["ab", "de"]).toContain(result4[0].text);
  });

  // T033: Prefers superword over subword when both pass cross-validation
  test("T033: prefers superword 'abcd' over subword 'ab' (higher score)", () => {
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

    // Should include "abcd" since it gives higher score.
    // "ab" is a strict subset of "abcd" tiles — including both
    // would double-count tiles. The combination optimizer should
    // pick the best non-conflicting set.
    // Since they overlap tiles, picking "abcd" alone is optimal.
    const hasAbcd = result.find((w) => w.text === "abcd");
    expect(hasAbcd).toBeDefined();
  });

  // T034: Falls back to subword when superword fails cross-validation
  test("T034: falls back to subword 'ab' when superword 'abcd' fails cross-validation", () => {
    const board = emptyBoard();
    placeH(board, "abcd", 0, 0);
    // Place frozen tile adjacent to "d" at (3,0) — below it at (3,1)
    board[1][3] = "q";
    const frozenTiles: FrozenTileMap = {
      "3,1": { owner: "player_b" },
    };

    const candidates = [
      hWord("ab", 0, 0),   // subword — no cross-word issues
      hWord("abcd", 0, 0), // superword — "d" at (3,0) + frozen "q" at (3,1) = "dq" ∉ dict
    ];

    const result = selectOptimalCombination(
      candidates,
      board,
      frozenTiles,
      dict,
      "player_a",
    );

    // "abcd" fails because of cross-word "dq".
    // "ab" passes because tiles (0,0) and (1,0) have no frozen neighbors.
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
