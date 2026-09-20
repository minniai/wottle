import { describe, expect, it } from "vitest";

import { letterAtFreeze, verifyMatchIntegrity, type IntegrityRecord } from "@/lib/match/matchIntegrity";

/**
 * Spec 049 T004 (contracts/integrity-check.md). A record must spell on the
 * persisted board and a frozen letter must never change after its freeze.
 */
const row = (letters: string) => [...letters];
const BOARD = [row("ÞAKSXHÚALG"), row("KTÆÍSIÓÚTÁ"), row("DISBTLNRXA")];
const FROZEN = { "0,0": { owner: "player_a" as const }, "1,0": { owner: "player_a" as const }, "2,0": { owner: "player_a" as const }, "3,0": { owner: "player_a" as const } };

const rec = (word: string, cells: [number, number][], round = 9): IntegrityRecord => ({
  id: `${word}@${round}`,
  word,
  roundNumber: round,
  tiles: cells.map(([x, y]) => ({ x, y })),
});

describe("verifyMatchIntegrity", () => {
  it("returns nothing for a clean match", () => {
    const records = [rec("þaks", [[0, 0], [1, 0], [2, 0], [3, 0]])];
    expect(verifyMatchIntegrity({ board: BOARD, records, frozenTiles: FROZEN, letterAtFreeze: { "0,0": "Þ", "1,0": "A", "2,0": "K", "3,0": "S" } })).toEqual([]);
  });

  it("folds Icelandic case before comparing (ð → Ð, æ → Æ, í → Í)", () => {
    const board = [row("ÐÆÍAAAAAAA")];
    const records = [rec("ðæí", [[0, 0], [1, 0], [2, 0]])];
    expect(verifyMatchIntegrity({ board, records, frozenTiles: {}, letterAtFreeze: {} })).toEqual([]);
  });

  it("a record whose letters moved is a spelling failure naming the letters found", () => {
    // The 20 September picture: the record is right, the served board is round 1's.
    const board = [row("ÞKHLXAGALG")];
    const records = [rec("þaks", [[0, 0], [1, 0], [2, 0], [3, 0]])];
    const failures = verifyMatchIntegrity({ board, records, frozenTiles: {}, letterAtFreeze: {} });
    expect(failures).toEqual([{ kind: "spelling", record: "þaks@9", round: 9, expected: "ÞAKS", found: "ÞKHL", cells: "(0,0)…(3,0)" }]);
  });

  it("a record with the wrong number of tiles is a spelling failure", () => {
    const records = [rec("þaks", [[0, 0], [1, 0], [2, 0]])];
    const [failure] = verifyMatchIntegrity({ board: BOARD, records, frozenTiles: {}, letterAtFreeze: {} });
    expect(failure).toMatchObject({ kind: "spelling", record: "þaks@9", found: "ÞAK" });
  });

  it("a frozen cell whose letter differs from the letter at its freeze is an immutability failure", () => {
    const failures = verifyMatchIntegrity({ board: BOARD, records: [], frozenTiles: FROZEN, letterAtFreeze: { "0,0": "Þ", "1,0": "K", "2,0": "K", "3,0": "S" } });
    expect(failures).toEqual([{ kind: "immutability", cell: "1,0", expected: "K", found: "A" }]);
  });

  it("a frozen cell with no known letter at freeze is not a failure", () => {
    expect(verifyMatchIntegrity({ board: BOARD, records: [], frozenTiles: FROZEN, letterAtFreeze: {} })).toEqual([]);
  });

  it("never throws on a ragged board or a cell off the board", () => {
    const records = [rec("abc", [[9, 9], [10, 9], [11, 9]])];
    expect(() => verifyMatchIntegrity({ board: [row("A")], records, frozenTiles: {}, letterAtFreeze: {} })).not.toThrow();
  });
});

describe("letterAtFreeze", () => {
  it("maps each frozen cell to the letter on the board of the round whose word froze it", () => {
    const rounds = [
      { roundNumber: 1, boardAfter: [row("ABCD")] },
      { roundNumber: 2, boardAfter: [row("ABXD")] }, // X moved in at (2,0) in round 2 — not a frozen cell of round 1's word
    ];
    const records = [rec("ab", [[0, 0], [1, 0]], 1), rec("xd", [[2, 0], [3, 0]], 2)];
    expect(letterAtFreeze(rounds, records)).toEqual({ "0,0": "A", "1,0": "B", "2,0": "X", "3,0": "D" });
  });

  it("the first freeze wins when two words share a cell", () => {
    const rounds = [{ roundNumber: 1, boardAfter: [row("AB")] }, { roundNumber: 2, boardAfter: [row("AB")] }];
    const records = [rec("ab", [[0, 0], [1, 0]], 1), rec("b", [[1, 0]], 2)];
    expect(letterAtFreeze(rounds, records)["1,0"]).toBe("B");
  });
});
