import { describe, expect, it } from "vitest";

import { getLanguagePack } from "@/lib/game-engine/languagePack";
import { resolveOne, type ClaimedMove } from "@/lib/match/moveResolver";
import type { BoardGrid } from "@/lib/types/board";

/**
 * Spec 060 FR-014: a match's moves are validated against its language's
 * dictionary and scored with its letter values. Row 0 spells CATS after
 * swapping (0,0)='X' with (9,9)='C'.
 */
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const rows = (r: string[]): BoardGrid => r.map((s) => [...s]);
const Q = "QQQQQQQQQQ";
const EN_DICT = new Set(["cats", "cat"]);

function move(over: Partial<ClaimedMove> = {}): ClaimedMove {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    playerId: A,
    globalSeq: 1,
    from: { x: 0, y: 0 },
    to: { x: 9, y: 9 },
    fromLetter: "X",
    toLetter: "C",
    receivedAt: "2026-09-22T12:00:00.000Z",
    ...over,
  };
}

describe("resolveOne in English", () => {
  it("scores an English word with English letter values", () => {
    const out = resolveOne({
      board: rows(["XATSZZZZZZ", Q, Q, Q, Q, Q, Q, Q, Q, "QQQQQQQQQC"]),
      frozenTiles: {},
      playerAId: A,
      playerBId: B,
      dictionary: EN_DICT,
      letterValues: getLanguagePack("en").letterValues,
      move: move(),
    });
    expect(out.status).toBe("resolved");
    expect(out.words.map((w) => w.word.toLowerCase())).toEqual(["cats"]);
    // C3 + A1 + T1 + S1 = 6 letter points, + (4 − 2) × 5 length bonus.
    expect(out.words[0].lettersPoints).toBe(6);
    expect(out.delta).toBe(16);
  });

  it("does not score an Icelandic word on an English match", () => {
    const out = resolveOne({
      board: rows(["XESTURZZZZ", Q, Q, Q, Q, Q, Q, Q, Q, "QQQQQQQQQH"]),
      frozenTiles: {},
      playerAId: A,
      playerBId: B,
      dictionary: EN_DICT,
      letterValues: getLanguagePack("en").letterValues,
      move: move({ toLetter: "H" }),
    });
    expect(out.words).toEqual([]);
  });
});
