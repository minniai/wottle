import { describe, expect, test } from "vitest";

import { mapWordScoreRow, mapWordScoreRows } from "@/lib/match/wordScoreRow";

const row = {
  player_id: "p1",
  word: "ráf",
  length: 3,
  letters_points: 9,
  bonus_points: 5,
  total_points: 14,
  tiles: [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }],
};

describe("mapWordScoreRow", () => {
  test("maps columns and derives the reading direction from tile order", () => {
    expect(mapWordScoreRow(row)).toEqual({
      playerId: "p1",
      word: "ráf",
      length: 3,
      lettersPoints: 9,
      bonusPoints: 5,
      totalPoints: 14,
      coordinates: row.tiles,
      direction: "rtl",
    });
  });

  test("legacy rows without usable tiles still map, with direction undefined", () => {
    const mapped = mapWordScoreRow({ ...row, tiles: null });
    expect(mapped.coordinates).toEqual([]);
    expect(mapped.direction).toBeUndefined();
  });

  test("mapWordScoreRows tolerates null input", () => {
    expect(mapWordScoreRows(null)).toEqual([]);
    expect(mapWordScoreRows([row])).toHaveLength(1);
  });
});
