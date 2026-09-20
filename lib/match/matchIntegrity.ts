import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Spec 049 (contracts/integrity-check.md): two invariants checked after every
 * round resolution, on the board the server just persisted.
 *
 *   1. spelling     — every word record spells its word at its tiles;
 *   2. immutability — a frozen cell's letter never changes after its freeze.
 *
 * Pure; never throws. The round engine and recovery call it with what they
 * already hold. On 2026-09-20 the records were all sound and the served board
 * was the wrong one (research.md §1); this is the check that would have named
 * it the day it happened.
 */
export interface IntegrityRecord {
  id: string;
  word: string;
  roundNumber: number;
  tiles: Coordinate[];
}

export type MatchIntegrityFailure =
  | { kind: "spelling"; record: string; round: number; expected: string; found: string; cells: string }
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
  return { kind: "spelling", record: record.id, round: record.roundNumber, expected, found, cells: describeRun(record.tiles) };
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

export interface RoundBoard {
  roundNumber: number;
  boardAfter: string[][] | null;
}

/**
 * The letter each frozen cell held when it froze: read from the persisted
 * board of the round whose word froze it, earliest round first, so no column
 * has to remember it.
 */
export function letterAtFreeze(rounds: RoundBoard[], records: IntegrityRecord[]): Record<string, string> {
  const boards = new Map(rounds.filter((r) => r.boardAfter).map((r) => [r.roundNumber, r.boardAfter as string[][]]));
  const out: Record<string, string> = {};
  for (const record of [...records].sort((a, b) => a.roundNumber - b.roundNumber)) {
    const board = boards.get(record.roundNumber);
    if (!board) continue;
    for (const tile of record.tiles) {
      const k = key(tile);
      if (out[k] === undefined) out[k] = letterAt(board, tile);
    }
  }
  return out;
}
