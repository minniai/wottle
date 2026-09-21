import {
  DONE_PLAYED,
  DONE_SUFFIX,
  doneFact,
  frozenJustNow,
  movedJustNow,
  moveOfSuffix,
  moveScored,
  moveScoring,
  moveScoringSuffix,
  moveYourMove,
  oppProgress,
  PICK_A_LETTER,
  scoredDelta,
  startsIn,
  TIME_SCORING,
} from "@/lib/constants/copy";
import type { Seat } from "@/lib/constants/seatColors";
import type { MatchState, MoveRejectionReason, PlayerMatchFacts, PlayerSlot } from "@/lib/types/match";

import { formatClock } from "./clock";
import { liveText, type LiveState } from "./liveLines";
import type { LiveLines } from "./ledgerTypes";

/**
 * The beat the viewer's move is in (spec 050, contracts/move-state.md).
 * Derived, never stored; it drives the live row's first line, the field's
 * turn frame and both bar sub-lines. The opponent's moves never change it.
 */
export type MoveState =
  | { kind: "starting"; seconds: number; opponentName: string }
  | { kind: "yourMove"; move: number; opponentName: string }
  | { kind: "rejected"; move: number; opponentName: string; reason: MoveRejectionReason }
  | { kind: "scoring"; move: number; opponentName: string }
  | { kind: "scored"; move: number; opponentName: string; delta: number; next: number }
  | { kind: "done"; opponentName: string; opponentMoves: number; clockMmSs: string }
  | { kind: "timeUp"; opponentName: string };

export interface DeriveMoveStateInput {
  match: MatchState;
  viewerSlot: PlayerSlot;
  opponentName: string;
  /** The viewer's move held after its reveal (FR-013); null when no hold runs. */
  holdMove: number | null;
  /** The viewer's own resolution is still drawing. */
  revealingOwn: boolean;
  /** A refusal notice is showing (two seconds). */
  rejected: MoveRejectionReason | null;
  /** The shared clock as the client reads it now. */
  clockMs: number;
  /** Until `started_at` (the server-anchored `3·2·1`); 0 or less once the match has started. */
  msToStart?: number;
}

export function viewerFacts(match: MatchState, viewerSlot: PlayerSlot): { you: PlayerMatchFacts; opp: PlayerMatchFacts } {
  const you = match.players[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = match.players[viewerSlot === "player_a" ? "playerB" : "playerA"];
  return { you, opp };
}

export function deriveMoveState(input: DeriveMoveStateInput): MoveState {
  const { match, viewerSlot, opponentName, holdMove, revealingOwn, rejected, clockMs } = input;
  const { you, opp } = viewerFacts(match, viewerSlot);
  const limit = match.moveLimit;
  const msToStart = input.msToStart ?? 0;
  if (msToStart > 0 && match.state === "in_progress") return { kind: "starting", seconds: Math.ceil(msToStart / 1000), opponentName };
  if (clockMs <= 0 && match.state === "in_progress") return { kind: "timeUp", opponentName };
  if (holdMove !== null) {
    return { kind: "scored", move: holdMove, opponentName, delta: you.lastResolution?.delta ?? 0, next: holdMove + 1 };
  }
  if (you.movesPlayed >= limit) {
    return { kind: "done", opponentName, opponentMoves: opp.movesPlayed, clockMmSs: formatClock(clockMs) };
  }
  const move = you.movesPlayed + 1;
  if (you.inFlight || revealingOwn) return { kind: "scoring", move, opponentName };
  if (rejected) return { kind: "rejected", move, opponentName, reason: rejected };
  return { kind: "yourMove", move, opponentName };
}

/** The field's instruction while a move is the viewer's to make. */
function instructionFor(field: LiveState): string {
  if (field.kind === "idle") return PICK_A_LETTER;
  const { line1, line2 } = liveText(field);
  return line2 ? `${line1} · ${line2}` : line1;
}

/** Line 1 is the move's beat in the board face, line 2 the instruction or the fact for that beat. */
export function liveLinesFor(state: MoveState, field: LiveState): LiveLines {
  switch (state.kind) {
    case "starting":
      return { line1: startsIn(state.seconds), line2: "" };
    case "yourMove":
      return { line1: moveYourMove(state.move), line2: instructionFor(field) };
    case "rejected":
      return { line1: moveYourMove(state.move), line2: state.reason === "frozen" ? frozenJustNow(state.opponentName) : movedJustNow(state.opponentName) };
    case "scoring":
      return { line1: moveScoring(state.move), line2: "" };
    case "scored":
      return { line1: moveScored(state.move), line2: scoredDelta(state.delta, state.next) };
    case "done":
      return { line1: DONE_PLAYED, line2: doneFact(state.opponentName, state.opponentMoves, state.clockMmSs) };
    case "timeUp":
      return { line1: TIME_SCORING, line2: "" };
  }
}

export interface BarCounts {
  you: number;
  opp: number;
  /** The opponent has a move in flight. */
  oppScoring: boolean;
  limit: number;
}

/** The suffix a bar's sub-line carries for this beat, or null when the clock is spent. */
export function barSuffixFor(state: MoveState, seat: Seat, counts: BarCounts): string | null {
  if (state.kind === "timeUp") return null;
  if (seat === "you") {
    if (state.kind === "done") return DONE_SUFFIX;
    if (state.kind === "scoring") return moveScoringSuffix(state.move);
    if (state.kind === "starting") return moveOfSuffix(counts.you + 1);
    return moveOfSuffix(state.move);
  }
  if (counts.opp >= counts.limit) return DONE_SUFFIX;
  return oppProgress(counts.opp, counts.oppScoring ? "scoring" : "playing");
}

/** The viewer's suffix is in the seat colour only while a move is theirs to make. */
export function barToneFor(state: MoveState): "seat" | "muted" {
  return state.kind === "yourMove" || state.kind === "rejected" ? "seat" : "muted";
}

/** The field is framed in the viewer's seat colour while a move is theirs to make. */
export function turnFrameFor(state: MoveState): Seat | null {
  return state.kind === "yourMove" || state.kind === "rejected" ? "you" : null;
}
