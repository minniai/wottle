import { describe, expect, test } from "vitest";

import { selectOptimalCombination } from "@/lib/game-engine/crossValidator";
import { loadDictionary } from "@/lib/game-engine/dictionary";
import { scoreMovesInReceiptOrder } from "../../../helpers/scoreMoves";
import type { BoardGrid, BoardWord, Coordinate } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

/**
 * The corner of the field from the 2026-09-23 screenshot. Column 1 reads
 * P A T I I downwards; row 3 is GILDA. Every other cell is Q, which spells
 * nothing in Icelandic.
 */
const CORNER = ["TPPUJ", "UAIÐE", "VTYAÖ", "GILDA", "JITÓÝ"];

function corner(): BoardGrid {
  const grid = Array.from({ length: 10 }, () => Array(10).fill("Q")) as BoardGrid;
  CORNER.forEach((row, y) => [...row].forEach((ch, x) => (grid[y][x] = ch)));
  return grid;
}

function line(text: string, tiles: Coordinate[], direction: BoardWord["direction"]): BoardWord {
  return { text, displayText: text.toUpperCase(), direction, start: tiles[0], length: tiles.length, tiles };
}

const column = (x: number, ys: number[]): Coordinate[] => ys.map((y) => ({ x, y }));
const row = (y: number, xs: number[]): Coordinate[] => xs.map((x) => ({ x, y }));

const PAT = line("pat", column(1, [0, 1, 2]), "down");
const TAP = line("tap", column(1, [2, 1, 0]), "up");
const PATI = line("pati", column(1, [0, 1, 2, 3]), "down");
const GILDA = line("gilda", row(3, [0, 1, 2, 3, 4]), "right");

function frozen(tiles: Coordinate[]): FrozenTileMap {
  return Object.fromEntries(tiles.map(({ x, y }) => [`${x},${y}`, { owner: "player_b" as const }]));
}

const tilesOf = (w: BoardWord): string => w.tiles.map(({ x, y }) => `${x},${y}`).join(" ");

/**
 * Rules §3.5a / §4, I3 and I7a: a scored run is one scored word. A new word may
 * not end against a frozen letter on its own axis — the longer run is the word,
 * or nothing is. A new letter that extends a frozen run on the other axis makes
 * that whole run a word scored by the same move, or the move scores nothing there.
 */
describe("I7a: a new word never ends against a frozen letter; the whole run scores instead", () => {
  test("GILDA frozen first: PAT and TAP end against its I and are refused; PATI scores", () => {
    const dictionary = new Set(["pat", "tap", "pati", "gilda"]);
    const result = selectOptimalCombination(
      [PAT, TAP, PATI],
      corner(),
      frozen(GILDA.tiles),
      dictionary,
      "player_b",
    );
    expect(result.map((w) => w.text)).toEqual(["pati"]);
  });

  test("GILDA frozen first: when PATI is not a word, nothing in the column scores", () => {
    const dictionary = new Set(["pat", "tap", "gilda"]);
    const result = selectOptimalCombination([PAT, TAP], corner(), frozen(GILDA.tiles), dictionary, "player_b");
    expect(result).toEqual([]);
  });
});

describe("I3: a new letter that extends a frozen run makes the whole run a scored word", () => {
  test("PAT frozen first: GILDA's I extends it to PATI, which scores with GILDA", () => {
    const dictionary = new Set(["pat", "tap", "pati", "gilda"]);
    const result = selectOptimalCombination([GILDA], corner(), frozen(PAT.tiles), dictionary, "player_b");
    expect(result.map((w) => `${w.text} ${w.direction} ${tilesOf(w)}`)).toEqual([
      "gilda right 0,3 1,3 2,3 3,3 4,3",
      "pati down 1,0 1,1 1,2 1,3",
    ]);
  });

  test("PAT frozen first: when PATI is not a word in either reading, GILDA is refused", () => {
    const dictionary = new Set(["pat", "tap", "gilda"]);
    const result = selectOptimalCombination([GILDA], corner(), frozen(PAT.tiles), dictionary, "player_b");
    expect(result).toEqual([]);
  });

  test("PAT frozen first: a run that reads as a word only upwards scores in that reading", () => {
    const dictionary = new Set(["pat", "tap", "itap", "gilda"]);
    const result = selectOptimalCombination([GILDA], corner(), frozen(PAT.tiles), dictionary, "player_b");
    const itap = result.find((w) => w.text === "itap");
    expect(itap && `${itap.direction} ${tilesOf(itap)}`).toBe("up 1,3 1,2 1,1 1,0");
  });
});

describe("the screenshot, resolved with the Icelandic dictionary", () => {
  const moveT = { playerId: "b", fromX: 9, fromY: 9, toX: 1, toY: 2 };
  const moveL = { playerId: "b", fromX: 9, fromY: 9, toX: 2, toY: 3 };

  function boardMissing(at: Coordinate): BoardGrid {
    const grid = corner();
    grid[9][9] = grid[at.y][at.x];
    grid[at.y][at.x] = "Q";
    return grid;
  }

  test("the swap that forms PAT under frozen GILDA scores PATI, not PAT and TAP", async () => {
    const dictionary = await loadDictionary("is");
    expect(["pat", "tap", "pati"].every((w) => dictionary.has(w))).toBe(true);
    expect(dictionary.has("itap")).toBe(false);
    const result = await scoreMovesInReceiptOrder({
      boardBefore: boardMissing({ x: 1, y: 2 }),
      acceptedMoves: [moveT],
      frozenTiles: frozen(GILDA.tiles),
      playerAId: "a",
      playerBId: "b",
    });
    expect(result.playerBWords.map(({ word }) => word)).toEqual(["pati"]);
    expect(result.newFrozenTiles["1,0"]).toBeDefined();
  });

  test("the swap that forms GILDA under frozen PAT scores GILDA and PATI", async () => {
    const result = await scoreMovesInReceiptOrder({
      boardBefore: boardMissing({ x: 2, y: 3 }),
      acceptedMoves: [moveL],
      frozenTiles: frozen(PAT.tiles),
      playerAId: "a",
      playerBId: "b",
    });
    expect(result.playerBWords.map(({ word }) => word).sort()).toEqual(["gilda", "pati"]);
  });
});
