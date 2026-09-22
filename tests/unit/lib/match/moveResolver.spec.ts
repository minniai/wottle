import { describe, expect, it } from "vitest";

import { resolveOne, type ClaimedMove } from "@/lib/match/moveResolver";
import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Spec 050 contracts/move-resolver.md: `resolveOne` is pure and deterministic
 * over the board, the freeze map and the one move. It refuses `frozen` and
 * `moved`, scores a legal swap from its two coordinates, and never counts a
 * refused move.
 */
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function board(rows: string[]): BoardGrid {
  return rows.map((r) => [...r]);
}

/** Row 0 spells HESTUR after swapping (0,0)='X' with (9,9)='H'. */
const BEFORE = board([
  "XESTURABCD",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQQ",
  "QQQQQQQQQH",
]);

const DICT = new Set(["hestur"]);

function move(over: Partial<ClaimedMove> = {}): ClaimedMove {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    playerId: A,
    globalSeq: 4,
    from: { x: 0, y: 0 },
    to: { x: 9, y: 9 },
    fromLetter: "X",
    toLetter: "H",
    receivedAt: "2026-09-21T12:00:00.000Z",
    ...over,
  };
}

const base = (frozen: FrozenTileMap = {}) => ({
  board: BEFORE,
  frozenTiles: frozen,
  playerAId: A,
  playerBId: B,
  dictionary: DICT,
  moverTotal: 40,
});

describe("resolveOne", () => {
  it("scores a legal swap from its two coordinates and freezes the word", () => {
    const out = resolveOne({ ...base(), move: move() });
    expect(out.status).toBe("resolved");
    expect(out.words.map((w) => w.word)).toEqual(["hestur"]);
    // H(4)+E(3)+S(1)+T(2)+U(2)+R(1)=13, length bonus (6−2)×5=20
    expect(out.delta).toBe(33);
    expect(out.boardAfter[0].join("")).toBe("HESTURABCD");
    expect(out.boardAfter[9][9]).toBe("X");
    expect(Object.keys(out.frozenAfter).sort()).toEqual(["0,0", "1,0", "2,0", "3,0", "4,0", "5,0"]);
    expect(out.frozenAfter["0,0"].owner).toBe("player_a");
    expect(out.boardBefore).toBe(BEFORE);
    expect(out.frozenBefore).toEqual({});
  });

  it("a move that forms no word is a miss: −5, no freeze (rules §5.6)", () => {
    const out = resolveOne({ ...base(), move: move({ from: { x: 5, y: 5 }, to: { x: 6, y: 6 }, fromLetter: "Q", toLetter: "Q" }) });
    expect(out.status).toBe("resolved");
    expect(out.words).toEqual([]);
    expect(out.delta).toBe(-5);
    expect(out.frozenAfter).toEqual({});
  });

  it("a miss never takes the mover's total below 0 (rules §5.6, 2026-09-22)", () => {
    const miss = move({ from: { x: 5, y: 5 }, to: { x: 6, y: 6 }, fromLetter: "Q", toLetter: "Q" });
    expect(resolveOne({ ...base(), moverTotal: 4, move: miss }).delta).toBe(-4);
    expect(Object.is(resolveOne({ ...base(), moverTotal: 0, move: miss }).delta, 0)).toBe(true);
    expect(resolveOne({ ...base(), moverTotal: 4, move: move() }).delta).toBe(33);
  });


  it("refuses `frozen` when either letter is frozen, writing nothing", () => {
    const frozen: FrozenTileMap = { "9,9": { owner: "player_b" } };
    const out = resolveOne({ ...base(frozen), move: move() });
    expect(out.status).toBe("rejected");
    expect(out.rejectionReason).toBe("frozen");
    expect(out.boardAfter).toBe(BEFORE);
    expect(out.frozenAfter).toBe(frozen);
    expect(out.words).toEqual([]);
    expect(out.delta).toBe(0);
  });

  it("refuses `moved` when a letter differs from the one the player saw", () => {
    const out = resolveOne({ ...base(), move: move({ fromLetter: "Z" }) });
    expect(out.status).toBe("rejected");
    expect(out.rejectionReason).toBe("moved");
    expect(out.boardAfter).toBe(BEFORE);
  });

  it("`frozen` is checked before `moved`", () => {
    const out = resolveOne({ ...base({ "0,0": { owner: "player_a" } }), move: move({ fromLetter: "Z" }) });
    expect(out.rejectionReason).toBe("frozen");
  });

  it("is deterministic: the same inputs give the same outcome twice", () => {
    const first = resolveOne({ ...base(), move: move() });
    const second = resolveOne({ ...base(), move: move() });
    expect(second).toEqual(first);
  });

  it("scores the opponent's move for the opponent's seat", () => {
    const out = resolveOne({ ...base(), move: move({ playerId: B }) });
    expect(out.frozenAfter["0,0"].owner).toBe("player_b");
    expect(out.words[0].playerId).toBe(B);
  });

  it("repeats score: the same word at a new location scores again (FR-007)", () => {
    // Row 9 reads QQQQQQQQQH; swapping (9,9) H with (9,8)... keep it simple:
    // a second board where the same word is formed elsewhere by a later move.
    const later = board([
      "HESTURABCD",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "QQQQQQQQQQ",
      "XESTURQQQH",
    ]);
    const frozen: FrozenTileMap = Object.fromEntries(
      [0, 1, 2, 3, 4, 5].map((x) => [`${x},0`, { owner: "player_a" as const }]),
    );
    const out = resolveOne({
      ...base(frozen),
      board: later,
      move: move({ from: { x: 0, y: 9 }, to: { x: 9, y: 9 }, fromLetter: "X", toLetter: "H" }),
    });
    expect(out.status).toBe("resolved");
    expect(out.words.map((w) => w.word)).toEqual(["hestur"]);
    expect(out.delta).toBe(33);
  });
});
