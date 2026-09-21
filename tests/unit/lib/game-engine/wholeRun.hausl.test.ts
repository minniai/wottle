import { describe, expect, test } from "vitest";

import { selectOptimalCombination } from "@/lib/game-engine/crossValidator";
import { loadDictionary } from "@/lib/game-engine/dictionary";
import { processRoundScoring } from "@/lib/game-engine/wordEngine";
import type { BoardGrid, BoardWord, Coordinate } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

function fixture(turns = 0): {
  board: BoardGrid;
  haus: BoardWord;
  sol: BoardWord;
  frozen: FrozenTileMap;
} {
  const board = Array.from({ length: 10 }, () => Array(10).fill(" ")) as BoardGrid;
  const rotate = (tile: Coordinate): Coordinate => {
    for (let i = 0; i < turns; i++) tile = { x: 9 - tile.y, y: tile.x };
    return tile;
  };
  const word = (text: string, tiles: Coordinate[]): BoardWord => {
    const rotated = tiles.map(rotate);
    rotated.forEach((tile, i) => {
      board[tile.y][tile.x] = text[i];
    });
    const [a, b] = rotated;
    const direction =
      a.x < b.x ? "right" : a.x > b.x ? "left" : a.y < b.y ? "down" : "up";
    return {
      text,
      displayText: text.toUpperCase(),
      length: text.length,
      start: a,
      tiles: rotated,
      direction,
    };
  };
  const haus = word(
    "haus",
    [0, 1, 2, 3].map((x) => ({ x, y: 4 })),
  );
  const sol = word(
    "sól",
    [2, 3, 4].map((y) => ({ x: 4, y })),
  );
  const frozen: FrozenTileMap = Object.fromEntries(
    haus.tiles.map(({ x, y }) => [`${x},${y}`, { owner: "player_a" }]),
  );
  return { board, haus, sol, frozen };
}

describe("I3: every affected scored run must be a whole dictionary word", () => {
  test.each([0, 1, 2, 3])(
    "rejects HAUSL despite the covering USL substring (rotation %i)",
    (turns) => {
      const { board, sol, frozen } = fixture(turns);
      const dictionary = new Set(["haus", "usl", "sól"]);
      expect(
        selectOptimalCombination([sol], board, frozen, dictionary, "player_b"),
      ).toEqual([]);
    },
  );

  test.each([0, 1, 2, 3])(
    "accepts a complete cross-run in either reading direction (rotation %i)",
    (turns) => {
      const { board, sol, frozen } = fixture(turns);
      // Synthetic dictionary entries isolate forward/reverse lookup behavior.
      for (const wholeRun of ["hausl", "lsuah"]) {
        const dictionary = new Set(["haus", "usl", "sól", wholeRun]);
        expect(
          selectOptimalCombination([sol], board, frozen, dictionary, "player_b"),
        ).toEqual([sol]);
      }
    },
  );

  test("rejects the invalid combination when HAUS is another candidate in the same scoring event", () => {
    const { board, haus, sol } = fixture();
    const dictionary = new Set(["haus", "usl", "sól"]);
    expect(
      selectOptimalCombination([haus, sol], board, {}, dictionary, "player_b"),
    ).toEqual([haus]);
    dictionary.add("hausl");
    expect(
      selectOptimalCombination([haus, sol], board, {}, dictionary, "player_b"),
    ).toEqual([haus, sol]);
  });

  test("does not score or freeze the L next to frozen HAUS with the real Icelandic dictionary", async () => {
    const dictionary = await loadDictionary();
    expect(dictionary.has("usl")).toBe(true);
    expect(dictionary.has("hausl")).toBe(false);
    expect(dictionary.has("lsuah")).toBe(false);
    const { board, frozen } = fixture();
    board[4][4] = "x";
    board[9][9] = "l";
    const params = {
      matchId: "hausl-regression",
      roundId: "round-2",
      boardBefore: board,
      acceptedMoves: [{ playerId: "b", fromX: 9, fromY: 9, toX: 4, toY: 4 }],
      playerAId: "a",
      playerBId: "b",
    };
    const rejected = await processRoundScoring({ ...params, frozenTiles: frozen });
    expect(rejected.playerBWords).toEqual([]);
    expect(rejected.deltas).toEqual({ playerA: 0, playerB: 0 });
    expect(rejected.newFrozenTiles).toEqual(frozen);
    expect(rejected.finalBoard[4][4]).toBe("l");

    // Ordinary unscored neighbors do not constrain a scored run.
    const accepted = await processRoundScoring({ ...params, frozenTiles: {} });
    expect(accepted.playerBWords.map(({ word }) => word)).toContain("sól");
    expect(accepted.newFrozenTiles["4,4"]).toBeDefined();
  });
});
