import type { BoardGrid, Coordinate } from "./board";
import type { FrozenTileMap, MatchEndedReason, WordScore } from "./match";

/** Spec 071: one received move of a completed match, as `GET /api/match/[id]/moves` serves it. */
export interface ReviewMoveRow {
  globalSeq: number;
  slot: "player_a" | "player_b";
  /** The mover's counted move number; null when refused. */
  seq: number | null;
  status: "resolved" | "rejected";
  rejectionReason: "frozen" | "moved" | null;
  swap: { from: Coordinate; to: Coordinate };
  receivedAt: string;
  boardAfter: BoardGrid;
  frozenAfter: FrozenTileMap;
  scoreAfter: { a: number; b: number };
  delta: number;
  words: WordScore[];
}

export interface MovesResponse {
  matchId: string;
  language: "is" | "en";
  players: { a: { id: string; displayName: string }; b: { id: string; displayName: string } };
  startedAt: string;
  durationMs: number;
  moveLimit: number;
  endedReason: MatchEndedReason;
  completedAt: string;
  winnerId: string | null;
  finalScores: { a: number; b: number };
  initialBoard: BoardGrid;
  moves: ReviewMoveRow[];
}

export type ReviewStepKind = "move" | "refused" | "closing";

/** One step of a review (`?review=index`), derived from the moves; never stored. */
export interface ReviewStep {
  /** 1-based. */
  index: number;
  kind: ReviewStepKind;
  /** Null for the closing step. */
  slot: "player_a" | "player_b" | null;
  /** The mover's counted move number (a refusal shows the number it would have been). */
  moveNumber: number | null;
  /** Time left on the match clock when the move was received. */
  clockMs: number;
  swap: { from: Coordinate; to: Coordinate } | null;
  board: BoardGrid;
  frozen: FrozenTileMap;
  words: WordScore[];
  /** This step's change to the mover's total (−5 for a miss; the penalties for the closing step). */
  points: number;
  totals: { a: number; b: number };
  movesPlayed: { a: number; b: number };
  /** Letters this step froze. */
  frozeCount: number;
  /** Why a refused step was refused. */
  refusal?: "frozen" | "moved";
  /** The closing step: each player's unplayed moves and what they cost (floored at the total). */
  closing?: { reason: "time" | "ended_early"; unplayed: { a: number; b: number }; penalty: { a: number; b: number } };
}
