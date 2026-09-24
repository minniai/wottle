import type { BoardGrid } from "@/lib/types/board";
import type { MatchEndedReason, WordScore } from "@/lib/types/match";
import type { MovesResponse, ReviewMoveRow } from "@/lib/types/review";

export const A = "00000000-0000-4000-8000-00000000000a";
export const B = "00000000-0000-4000-8000-00000000000b";
const STARTED = Date.parse("2026-09-24T12:00:00.000Z");

/** A board whose top-left letter names the step it is the result of. */
export function boardMarked(mark: string): BoardGrid {
  return Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (x === 0 && y === 0 ? mark : "x")));
}

export interface RowSpec {
  slot: "player_a" | "player_b";
  /** Points scored; 0 with no words means a miss of −5. */
  points?: number;
  refused?: boolean;
  /** Seconds after the start that the server received it. */
  at: number;
  freezes?: number;
}

function wordFor(slot: RowSpec["slot"], points: number, x: number): WordScore {
  return { playerId: slot === "player_a" ? A : B, word: "LEK", length: 3, lettersPoints: points - 5, bonusPoints: 5, totalPoints: points, coordinates: [{ x, y: 1 }, { x, y: 2 }, { x, y: 3 }] };
}

/** Builds rows the way `finish_move` writes them: running totals, counted seqs, frozen maps. */
export function rowsFrom(specs: RowSpec[]): ReviewMoveRow[] {
  const totals = { a: 0, b: 0 };
  const seq = { a: 0, b: 0 };
  let frozen: Record<string, { owner: "player_a" | "player_b" }> = {};
  let board = boardMarked("0");
  return specs.map((spec, i) => {
    const side = spec.slot === "player_a" ? "a" : "b";
    const refused = spec.refused ?? false;
    const points = refused ? 0 : spec.points && spec.points > 0 ? spec.points : Math.max(-5, -totals[side]);
    if (!refused) {
      seq[side] += 1;
      totals[side] += points;
      board = boardMarked(String(i + 1));
      const added = Object.fromEntries(Array.from({ length: spec.freezes ?? 0 }, (_, k) => [`${i},${k}`, { owner: spec.slot }]));
      frozen = { ...frozen, ...added };
    }
    return {
      globalSeq: i + 1,
      slot: spec.slot,
      seq: refused ? null : seq[side],
      status: refused ? "rejected" : "resolved",
      rejectionReason: refused ? "frozen" : null,
      swap: { from: { x: i % 10, y: 0 }, to: { x: i % 10, y: 1 } },
      receivedAt: new Date(STARTED + spec.at * 1000).toISOString(),
      boardAfter: board,
      frozenAfter: { ...frozen },
      scoreAfter: { ...totals },
      delta: refused ? 0 : points,
      words: !refused && spec.points && spec.points > 0 ? [wordFor(spec.slot, spec.points, i % 10)] : [],
    } satisfies ReviewMoveRow;
  });
}

export function movesResponse(rows: ReviewMoveRow[], endedReason: MatchEndedReason, finalScores: { a: number; b: number }, completedAt = STARTED + 300_000): MovesResponse {
  return {
    matchId: "00000000-0000-4000-8000-0000000000aa",
    language: "is",
    players: { a: { id: A, displayName: "Birna" }, b: { id: B, displayName: "Kári" } },
    startedAt: new Date(STARTED).toISOString(),
    durationMs: 300_000,
    moveLimit: 10,
    endedReason,
    completedAt: new Date(completedAt).toISOString(),
    winnerId: null,
    finalScores,
    initialBoard: boardMarked("0"),
    moves: rows,
  };
}

/** Both play ten; Kári's moves 5 and 6 arrive back to back (steps 5 and 6). 20 steps. */
export function bothFinished(): MovesResponse {
  const order: RowSpec["slot"][] = ["player_a", "player_b", "player_a", "player_b", "player_b", "player_b", "player_a", "player_a", "player_b", "player_a",
    "player_b", "player_a", "player_b", "player_a", "player_b", "player_a", "player_b", "player_a", "player_b", "player_a"];
  const rows = rowsFrom(order.map((slot, i) => ({ slot, at: 10 + i * 12, points: i % 4 === 3 ? 0 : 10 + i, freezes: i % 4 === 3 ? 0 : 3 })));
  return movesResponse(rows, "moves_complete", rows[rows.length - 1].scoreAfter);
}
