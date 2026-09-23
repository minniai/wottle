import type { Copy } from "@/lib/i18n/copy/types";
import type { Seat } from "@/lib/constants/seatColors";
import type { MatchState, MoveRejectionReason, PlayerMatchFacts, PlayerSlot } from "@/lib/types/match";

import { formatClock } from "./clock";
import { liveText, type LiveState } from "./liveLines";
import { selectLine2, type Line2Kind, type Line2Source } from "./liveLine2";
import { MISS_PENALTY } from "@/lib/scoring/missPenalty";
import type { LiveLines } from "./ledgerTypes";

/**
 * The beat the viewer's move is in (spec 050, contracts/move-state.md).
 * Derived, never stored; it drives the live row's first line, the field's
 * turn frame and both bar sub-lines. The opponent's moves never change it.
 */
export type MoveState =
  /** Spec 069: the match is a table; nobody plays until both sit down. */
  | { kind: "table"; opponentName: string }
  /** Spec 069: the table did not fill, or someone left it. */
  | { kind: "void"; opponentName: string }
  | { kind: "starting"; seconds: number; opponentName: string }
  | { kind: "yourMove"; move: number; opponentName: string }
  | { kind: "rejected"; move: number; opponentName: string; reason: MoveRejectionReason }
  | { kind: "scoring"; move: number; opponentName: string }
  | { kind: "scored"; move: number; opponentName: string; delta: number; next: number; missed?: boolean }
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
  if (match.state === "completed" && match.endedReason === "void") return { kind: "void", opponentName };
  if (match.state === "pending") return { kind: "table", opponentName };
  if (msToStart > 0 && match.state === "in_progress") return { kind: "starting", seconds: Math.ceil(msToStart / 1000), opponentName };
  if (clockMs <= 0 && match.state === "in_progress") return { kind: "timeUp", opponentName };
  if (holdMove !== null) {
    const last = you.lastResolution;
    // A move that found no word is a miss (spec 068 FR-028): its beat says so.
    const missed = Boolean(last) && last!.words.length === 0 && last!.delta <= 0;
    return { kind: "scored", move: holdMove, opponentName, delta: last?.delta ?? 0, next: holdMove + 1, ...(missed ? { missed } : {}) };
  }
  if (you.movesPlayed >= limit) {
    return { kind: "done", opponentName, opponentMoves: opp.movesPlayed, clockMmSs: formatClock(clockMs) };
  }
  const move = you.movesPlayed + 1;
  if (you.inFlight || revealingOwn) return { kind: "scoring", move, opponentName };
  if (rejected) return { kind: "rejected", move, opponentName, reason: rejected };
  return { kind: "yourMove", move, opponentName };
}

/**
 * What else may claim line 2 of the live row (spec 068 FR-029–FR-031, FR-038):
 * each comes and goes on its own timer; `selectLine2` shows the highest.
 */
export interface Line2Extras {
  offline?: boolean;
  /** Just back after losing the match's connection: how long the viewer was away. */
  backAwayMs?: number | null;
  submitError?: string | null;
  /** The opponent's move took the letter the viewer had picked. */
  pickClearedBy?: string | null;
  /** The viewer chose `keep waiting`: the end-early offer lives here, as a secondary action. */
  endEarlyOffer?: string | null;
  /** Under 1:00 with a move to make: the moves left and what they cost at 0:00. */
  stakes?: { movesLeft: number; penalty: number } | null;
}

const text = (kind: Line2Kind, words: string): Line2Source => ({ kind, text: words });

/** The field's instruction while a move is the viewer's to make; an illegal pick names the word (FR-030). */
function instructionFor(field: LiveState, copy: Copy): Line2Source {
  if (field.kind === "illegal") {
    return text("refused", field.word ? copy.frozenWord(field.word, field.ownerName) : copy.frozenNotice(field.ownerName, field.round));
  }
  if (field.kind === "idle") return text("instruction", copy.PICK_A_LETTER);
  const { line1, line2 } = liveText(field, copy);
  return text("instruction", line2 ? `${line1} · ${line2}` : line1);
}

function lossSource(value: number, after: string, copy: Copy): Line2Source {
  return { kind: "missedOrStakes", text: `${copy.points(value)}${after}`, parts: [{ pointsLost: { value } }, { text: after }] };
}

function missedSource(state: Extract<MoveState, { kind: "scored" }>, copy: Copy): Line2Source {
  const after = state.delta <= MISS_PENALTY ? ` · ${copy.moveOpens(state.next)}` : ` · ${copy.TOTAL_NEVER_BELOW_ZERO}`;
  return lossSource(state.delta, after, copy);
}

function stakesSource(stakes: NonNullable<Line2Extras["stakes"]>, copy: Copy): Line2Source {
  const left = `${copy.movesLeftShort(stakes.movesLeft)} · `;
  if (stakes.penalty >= 0) return text("missedOrStakes", `${left}${copy.NOTHING_TO_LOSE}`);
  const words = `${left}${copy.points(stakes.penalty)} ${copy.IF_UNPLAYED}`;
  return { kind: "missedOrStakes", text: words, parts: [{ text: left }, { pointsLost: { value: stakes.penalty, label: copy.IF_UNPLAYED } }] };
}

function extraSources(extras: Line2Extras, copy: Copy): Partial<Record<Line2Kind, Line2Source>> {
  const out: Partial<Record<Line2Kind, Line2Source>> = {};
  if (extras.offline) out.offline = text("offline", copy.OFFLINE_RECONNECTING);
  if (extras.backAwayMs != null) out.back = text("back", copy.backAway(formatClock(extras.backAwayMs)));
  if (extras.submitError) out.submitError = text("submitError", extras.submitError);
  if (extras.pickClearedBy) out.pickCleared = text("pickCleared", copy.pickClearedMoved(extras.pickClearedBy));
  if (extras.endEarlyOffer) {
    const lead = copy.endEarlyOfferLead(extras.endEarlyOffer);
    out.endEarlyOffer = { kind: "endEarlyOffer", text: `${lead}${copy.END_THE_MATCH}`, parts: [{ text: lead }, { action: { label: copy.END_THE_MATCH, action: "endEarly" } }] };
  }
  return out;
}

/** The beat's own claim on line 2: the instruction, a refusal, the missed beat, the stakes or the beat's fact. */
function stateSources(state: MoveState, field: LiveState, extras: Line2Extras, copy: Copy): Partial<Record<Line2Kind, Line2Source>> {
  switch (state.kind) {
    case "yourMove": {
      const own = instructionFor(field, copy);
      const stakes = field.kind === "idle" && extras.stakes ? { missedOrStakes: stakesSource(extras.stakes, copy) } : {};
      return { [own.kind]: own, ...stakes };
    }
    case "rejected":
      return { refused: text("refused", state.reason === "frozen" ? copy.frozenJustNow(state.opponentName) : copy.movedJustNow(state.opponentName)) };
    case "scored":
      return state.missed ? { missedOrStakes: missedSource(state, copy) } : { instruction: text("instruction", copy.scoredDelta(state.delta, state.next)) };
    case "done":
      return { instruction: text("instruction", copy.doneFact(state.opponentName, state.opponentMoves, state.clockMmSs)) };
    default:
      return {};
  }
}

function line1For(state: MoveState, copy: Copy): string {
  switch (state.kind) {
    case "table":
    case "void":
      return "";
    case "starting":
      return copy.startsIn(state.seconds);
    case "yourMove":
    case "rejected":
      return copy.moveYourMove(state.move);
    case "scoring":
      return copy.moveScoring(state.move);
    case "scored":
      return state.missed ? copy.moveNoWord(state.move) : copy.moveScored(state.move);
    case "done":
      return copy.DONE_PLAYED;
    case "timeUp":
      return copy.TIME_SCORING;
  }
}

/** Line 1 is the move's beat in the board face; line 2 the one thing that matters now (spec 068 FR-031). */
export function liveLinesFor(state: MoveState, field: LiveState, copy: Copy, extras: Line2Extras = {}): LiveLines {
  // At the table and the void the ledger has no live row (spec 069 C1, C3).
  if (state.kind === "table" || state.kind === "void") return { line1: "", line2: "" };
  const line2 = selectLine2({ ...stateSources(state, field, extras, copy), ...extraSources(extras, copy) });
  if (!line2) return { line1: line1For(state, copy), line2: "" };
  return { line1: line1For(state, copy), line2: line2.text, ...(line2.parts ? { line2Parts: line2.parts } : {}) };
}

/** The field is framed in the viewer's seat colour while a move is theirs to make. */
export function turnFrameFor(state: MoveState): Seat | null {
  return state.kind === "yourMove" || state.kind === "rejected" ? "you" : null;
}
