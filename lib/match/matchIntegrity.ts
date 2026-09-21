import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Spec 049 (contracts/integrity-check.md): two invariants checked after every
 * resolved move (spec 050), on the board the server just persisted.
 *
 *   1. spelling     — every word record spells its word at its tiles;
 *   2. immutability — a frozen cell's letter never changes after its freeze.
 *
 * Pure; never throws. The move resolver calls it (via `checkMoveIntegrity`)
 * with what it already holds. On 2026-09-20 the records were all sound and the served board
 * was the wrong one (research.md §1); this is the check that would have named
 * it the day it happened.
 */
export interface IntegrityRecord {
  id: string;
  word: string;
  /** The receipt sequence of the move that scored the record. */
  globalSeq: number;
  tiles: Coordinate[];
}

export type MatchIntegrityFailure =
  | { kind: "spelling"; record: string; globalSeq: number; expected: string; found: string; cells: string }
  | { kind: "immutability"; cell: string; expected: string; found: string };

export interface VerifyMatchIntegrityInput {
  board: string[][];
  records: IntegrityRecord[];
  frozenTiles: FrozenTileMap;
  /** Cell key → the letter that was there when the cell froze (see `letterAtFreeze`). */
  letterAtFreeze: Record<string, string>;
}

const upper = (s: string): string => s.toLocaleUpperCase("is");
const key = (c: Coordinate): string => `${c.x},${c.y}`;
const letterAt = (board: string[][], c: Coordinate): string => upper(board[c.y]?.[c.x] ?? "?");

function describeRun(tiles: Coordinate[]): string {
  const first = tiles[0];
  const last = tiles[tiles.length - 1];
  return `(${first?.x},${first?.y})…(${last?.x},${last?.y})`;
}

function checkSpelling(board: string[][], record: IntegrityRecord): MatchIntegrityFailure | null {
  const expected = upper(record.word);
  const found = record.tiles.map((t) => letterAt(board, t)).join("");
  if (found === expected && [...expected].length === record.tiles.length) return null;
  return { kind: "spelling", record: record.id, globalSeq: record.globalSeq, expected, found, cells: describeRun(record.tiles) };
}

export function verifyMatchIntegrity(input: VerifyMatchIntegrityInput): MatchIntegrityFailure[] {
  const failures: MatchIntegrityFailure[] = [];
  for (const record of input.records) {
    const failure = checkSpelling(input.board, record);
    if (failure) failures.push(failure);
  }
  for (const cell of Object.keys(input.frozenTiles)) {
    const expected = input.letterAtFreeze[cell];
    if (expected === undefined) continue;
    const [x, y] = cell.split(",").map(Number);
    const found = letterAt(input.board, { x, y });
    if (found !== upper(expected)) failures.push({ kind: "immutability", cell, expected: upper(expected), found });
  }
  return failures;
}

export interface MoveBoard {
  globalSeq: number;
  boardAfter: string[][] | null;
}

/**
 * The letter each frozen cell held when it froze: read from the persisted
 * board of the move whose word froze it, earliest move first, so no column
 * has to remember it.
 */
export function letterAtFreeze(moves: MoveBoard[], records: IntegrityRecord[]): Record<string, string> {
  const boards = new Map(moves.filter((m) => m.boardAfter).map((m) => [m.globalSeq, m.boardAfter as string[][]]));
  const out: Record<string, string> = {};
  for (const record of [...records].sort((a, b) => a.globalSeq - b.globalSeq)) {
    const board = boards.get(record.globalSeq);
    if (!board) continue;
    for (const tile of record.tiles) {
      const k = key(tile);
      if (out[k] === undefined) out[k] = letterAt(board, tile);
    }
  }
  return out;
}
