import type { BoardGrid } from "@/lib/types/board";
import type { FrozenTileMap, MatchEndedReason } from "@/lib/types/match";
import type { MovesResponse, ReviewMoveRow, ReviewStep } from "@/lib/types/review";

/**
 * Spec 071 (FR-031): a completed match's review steps. Every received move is a step, in the
 * order the server received it (`global_seq`), refusals included. When the settlement penalised
 * unplayed moves (0:00, or an early end) a closing step applies them, so the last step always
 * equals the recorded result: the move rows never carry those penalties (research R2).
 */
export function buildReviewSteps(moves: MovesResponse): ReviewStep[] {
  const rows = [...moves.moves].sort((p, q) => p.globalSeq - q.globalSeq);
  const steps: ReviewStep[] = [];
  let previous = openingState(moves.initialBoard);
  for (const row of rows) {
    const step = toStep(row, previous, steps.length + 1, moves);
    steps.push(step);
    previous = step;
  }
  const closing = closingStep(moves, previous, steps.length + 1);
  return closing ? [...steps, closing] : steps;
}

type Prior = Pick<ReviewStep, "board" | "frozen" | "totals" | "movesPlayed">;

function openingState(board: BoardGrid): Prior {
  return { board, frozen: {}, totals: { a: 0, b: 0 }, movesPlayed: { a: 0, b: 0 } };
}

function sideOf(slot: "player_a" | "player_b"): "a" | "b" {
  return slot === "player_a" ? "a" : "b";
}

function toStep(row: ReviewMoveRow, prior: Prior, index: number, moves: MovesResponse): ReviewStep {
  const side = sideOf(row.slot);
  const refused = row.status === "rejected";
  const movesPlayed = refused ? prior.movesPlayed : { ...prior.movesPlayed, [side]: prior.movesPlayed[side] + 1 };
  return {
    index,
    kind: refused ? "refused" : "move",
    slot: row.slot,
    moveNumber: refused ? prior.movesPlayed[side] + 1 : row.seq,
    clockMs: clockAt(Date.parse(row.receivedAt), moves),
    swap: row.swap,
    board: refused ? prior.board : row.boardAfter,
    frozen: refused ? prior.frozen : row.frozenAfter,
    words: refused ? [] : row.words,
    points: row.scoreAfter[side] - prior.totals[side],
    totals: row.scoreAfter,
    movesPlayed,
    frozeCount: refused ? 0 : newlyFrozen(prior.frozen, row.frozenAfter),
  };
}

function clockAt(atMs: number, moves: MovesResponse): number {
  return Math.max(0, moves.durationMs - (atMs - Date.parse(moves.startedAt)));
}

function newlyFrozen(before: FrozenTileMap, after: FrozenTileMap): number {
  return Object.keys(after).filter((key) => !(key in before)).length;
}

const CLOSING_REASONS: Partial<Record<MatchEndedReason, "time" | "ended_early">> = {
  incomplete: "time",
  both_incomplete: "time",
  ended_early: "ended_early",
};

function closingStep(moves: MovesResponse, prior: Prior, index: number): ReviewStep | null {
  const reason = CLOSING_REASONS[moves.endedReason];
  const unplayed = { a: moves.moveLimit - prior.movesPlayed.a, b: moves.moveLimit - prior.movesPlayed.b };
  if (!reason || (unplayed.a <= 0 && unplayed.b <= 0)) return null;
  const penalty = { a: moves.finalScores.a - prior.totals.a, b: moves.finalScores.b - prior.totals.b };
  return {
    ...prior,
    index,
    kind: "closing",
    slot: null,
    moveNumber: null,
    clockMs: reason === "time" ? 0 : clockAt(Date.parse(moves.completedAt), moves),
    swap: null,
    words: [],
    points: penalty.a + penalty.b,
    totals: moves.finalScores,
    frozeCount: 0,
    closing: { reason, unplayed: { a: Math.max(0, unplayed.a), b: Math.max(0, unplayed.b) }, penalty },
  };
}
