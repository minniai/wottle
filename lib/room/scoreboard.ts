import type { Copy } from "@/lib/i18n/copy/types";
import type { Seat } from "@/lib/constants/seatColors";

import { behindPace, clockBlocks, clockRowPhase, formatClock, pace, ticksLeft, type ClockRowPhase } from "./clock";
import type { MoveState } from "./moveState";
import { segmentStates, type SegmentState } from "./segments";

/**
 * The scoreboard (spec 068, contracts/scoreboard.md): one box above the field
 * holding the match clock and both players on one ten-column track, so time
 * left and moves left compare down a column. Derived, never stored; it reads
 * no clock of its own.
 *
 *   ┌──────────────┬──────────────────────────────┬──────┐
 *   │ ≈27s a move  │ ▮▮▮▮▮▮ ×6  ▮▮▮··· ······ ×3  │ 3:12 │  clock: 10 blocks × 6 ticks
 *   │ Kári         │ ■ ■ ■ ■ □ □ □ □ □ □          │  34  │  opponent: moves left, then spent
 *   │ Birna        │ ■ ■ ■ ■ ■ ■ ■ □ □ □          │  44  │  you: nearest the board you play on
 *   └──────────────┴──────────────────────────────┴──────┘
 */

export type ScoreboardPhase = "table" | "void" | "starting" | "live" | "over";

/** Spec 069: who has sat down, and at the void, why there was no match. */
export interface ScoreboardTable {
  youSeated: boolean;
  oppSeated: boolean;
  /** The void named the opponent: they never sat down, or they left. */
  oppVoid?: "notSeated" | "left" | null;
  /** The viewer is back in the queue after a void. */
  youRequeued?: boolean;
}

export interface ScoreboardSeat {
  name: string;
  rating: number | null;
  movesPlayed: number;
  inFlight: boolean;
  score: number;
  /** The opponent's reconnection window is open: ms left in it. */
  reconnectMsLeft?: number | null;
  /** The window is spent and the opponent is still away: how long. */
  goneForMs?: number | null;
  /** Spec 070 US8: the opponent's app is open on another page. */
  steppedOut?: boolean;
  /** The viewer's own transport has lost the match. */
  offline?: boolean;
  /** Match over: the rating line (`1204 → 1212 · +8 · wins`, or `rating pending`). */
  finalLine?: string;
  /** Spec 071 (FR-020): the opponent has left the result, so no rematch will come. */
  left?: boolean;
}

export interface ScoreboardInput {
  phase: ScoreboardPhase;
  /** The viewer's beat; null when read-only or over. */
  moveState: MoveState | null;
  remainingMs: number;
  clockLengthMs: number;
  moveLimit: number;
  /** Starting: ms until `started_at`; the clock row fills over the count. */
  msToStart?: number;
  /** Over: how long the match ran. */
  elapsedMs?: number;
  readOnly: boolean;
  /** The phone's rows: the short count only, no rating (spec 068 FR-009). */
  compact?: boolean;
  you: ScoreboardSeat;
  opp: ScoreboardSeat;
  /** The table and the void (spec 069). */
  table?: ScoreboardTable;
  /** Spec 071: `match 2 · Birna 1–0`, a fact about the match, under the clock's label when nothing else is. */
  series?: string | null;
  /** Spec 071 (FR-033): review at a step; the seats carry each player's total and moves at it. */
  review?: ScoreboardReview;
}

export interface ScoreboardReview {
  step: number;
  stepCount: number;
  /** The clock as it read when the step's move was received. */
  clockMs: number;
  valueText: string;
}

export type ScoreboardClockPhase = ClockRowPhase | "table" | "void" | "starting" | "over" | "review";

export interface ClockRow {
  phase: ScoreboardClockPhase;
  /** The phase in words: `match clock`, `under a minute`, `last 12s`, `time`, `starts in 3`, `match over`. */
  label: string;
  /** Under the label: the pace while the move is yours, or the match's length at the end; "" otherwise. */
  detail: string;
  numeral: string;
  ticksLeft: number;
  blocks: number[];
  /** Spec 071: in review the track is the scrubber, at `step / stepCount`. */
  review?: { step: number; stepCount: number; fraction: number; valueText: string };
}

export interface PlayerRow {
  seat: Seat;
  name: string;
  /** The muted part of the sub-line: the rating and the seat word, or the final rating line. */
  muted: string;
  /** This moment's fact about the player, or null. */
  suffix: string | null;
  tone: "seat" | "muted";
  segments: SegmentState[];
  laneMode: "moves" | "outlined";
  total: number;
  /** No total before a match starts (spec 069: the table and the void). */
  showTotal: boolean;
  movesLeft: number;
  behindPace: boolean;
}

export interface ScoreboardView {
  clock: ClockRow;
  opp: PlayerRow;
  you: PlayerRow;
}

/** The 3·2·1 before `started_at`: the clock row loads over it. */
const START_COUNT_MS = 3_000;
const FULL_TICKS = 60;

function isYourMove(state: MoveState | null): boolean {
  return state?.kind === "yourMove" || state?.kind === "rejected";
}

function movesLeftOf(seat: ScoreboardSeat, limit: number): number {
  return Math.max(0, limit - seat.movesPlayed);
}

function liveLabel(input: ScoreboardInput, phase: ClockRowPhase, copy: Copy): string {
  if (phase === "time") return copy.TIME_SPENT;
  if (phase === "lastSeconds") return copy.lastSeconds(Math.ceil(input.remainingMs / 1000));
  return phase === "underMinute" ? copy.UNDER_A_MINUTE : copy.MATCH_CLOCK;
}

/** The pace, only while the move is yours and there is time to share out. */
function liveDetail(input: ScoreboardInput, phase: ClockRowPhase, copy: Copy): string {
  if (phase === "time" || !isYourMove(input.moveState)) return "";
  const seconds = pace(input.remainingMs, movesLeftOf(input.you, input.moveLimit));
  return seconds === null ? "" : copy.paceLabel(seconds);
}

function startingTicks(msToStart: number): number {
  const loaded = 1 - Math.min(START_COUNT_MS, Math.max(0, msToStart)) / START_COUNT_MS;
  return Math.round(FULL_TICKS * loaded);
}

/** The clock never ran: full, still, and saying why (spec 069 C1, C3). */
function stillClock(input: ScoreboardInput, phase: "table" | "void", copy: Copy): ClockRow {
  const detail = phase === "table" ? copy.table.STARTS_WHEN_SEATED : copy.table.NOT_STARTED;
  return { phase, label: copy.MATCH_CLOCK, detail, numeral: formatClock(input.clockLengthMs), ticksLeft: FULL_TICKS, blocks: clockBlocks(FULL_TICKS) };
}

/** Spec 071 (FR-033): the clock row as the review's scrubber: the step, and the clock when its move came in. */
function reviewClock(review: ScoreboardReview, input: ScoreboardInput, copy: Copy): ClockRow {
  const ticks = ticksLeft(review.clockMs);
  const { step, stepCount, valueText } = review;
  return {
    phase: "review",
    label: input.compact ? copy.review.step(step, stepCount).split(" ").slice(0, 2).join(" ") : copy.review.step(step, stepCount),
    detail: input.compact ? copy.review.CLOCK_THEN : copy.review.clockAt(step),
    numeral: formatClock(review.clockMs),
    ticksLeft: ticks,
    blocks: clockBlocks(ticks),
    review: { step, stepCount, fraction: step / stepCount, valueText },
  };
}

function clockRowFor(input: ScoreboardInput, copy: Copy): ClockRow {
  if (input.review) return reviewClock(input.review, input, copy);
  if (input.phase === "table" || input.phase === "void") return withSeries(stillClock(input, input.phase, copy), input);
  if (input.phase === "starting") {
    const ticks = startingTicks(input.msToStart ?? 0);
    const label = copy.startsIn(Math.max(1, Math.ceil((input.msToStart ?? 0) / 1000)));
    return withSeries({ phase: "starting", label, detail: "", numeral: formatClock(input.clockLengthMs), ticksLeft: ticks, blocks: clockBlocks(ticks) }, input);
  }
  const ticks = ticksLeft(input.remainingMs);
  const numeral = formatClock(input.remainingMs);
  if (input.phase === "over") {
    const detail = copy.clockOfLength(formatClock(input.elapsedMs ?? input.clockLengthMs - input.remainingMs), formatClock(input.clockLengthMs));
    return { phase: "over", label: copy.MATCH_OVER, detail, numeral, ticksLeft: ticks, blocks: clockBlocks(ticks) };
  }
  const phase = clockRowPhase(input.remainingMs);
  return withSeries({ phase, label: liveLabel(input, phase, copy), detail: liveDetail(input, phase, copy), numeral, ticksLeft: ticks, blocks: clockBlocks(ticks) }, input);
}

/** The series fills the detail line only when it is empty: the pace outranks it. */
function withSeries(row: ClockRow, input: ScoreboardInput): ClockRow {
  return row.detail || !input.series ? row : { ...row, detail: input.series };
}

interface Sub {
  suffix: string | null;
  tone: "seat" | "muted";
  /** A condition that crowds out the seat word (`behind pace`, `gone for`, …). */
  alert: boolean;
}

const plain = (suffix: string | null, tone: "seat" | "muted" = "muted"): Sub => ({ suffix, tone, alert: false });

function oppSub(input: ScoreboardInput, copy: Copy): Sub {
  const { opp, moveLimit } = input;
  if (opp.reconnectMsLeft != null && opp.reconnectMsLeft > 0) return { suffix: copy.reconnecting(formatClock(opp.reconnectMsLeft)), tone: "muted", alert: true };
  if (opp.goneForMs != null) return { suffix: copy.goneFor(opp.movesPlayed, formatClock(opp.goneForMs)), tone: "muted", alert: true };
  if (opp.steppedOut) return { suffix: copy.steppedOut(opp.movesPlayed), tone: "muted", alert: true };
  if (opp.movesPlayed >= moveLimit) return plain(copy.DONE_SUFFIX);
  return plain(copy.oppProgress(opp.movesPlayed, opp.inFlight ? "scoring" : "playing"));
}

function youSub(input: ScoreboardInput, behind: boolean, copy: Copy): Sub {
  const { you, moveState, moveLimit } = input;
  if (you.offline) return { suffix: copy.OFFLINE_RECONNECTING, tone: "muted", alert: true };
  if (moveState?.kind === "timeUp") return plain(null);
  if (you.movesPlayed >= moveLimit) return plain(copy.DONE_SUFFIX);
  if (moveState?.kind === "scoring") return plain(copy.moveScoringSuffix(moveState.move));
  const move = you.movesPlayed + 1;
  if (behind) return { suffix: copy.moveBehindPace(move), tone: "seat", alert: true };
  return plain(copy.moveOfSuffix(move), isYourMove(moveState) ? "seat" : "muted");
}

/** The phone's rows: one short fact each (`6 of 10`, `move 4`, `gone for 2:04`). */
function compactSub(input: ScoreboardInput, seat: Seat, behind: boolean, copy: Copy): Sub {
  const facts = input[seat];
  const done = facts.movesPlayed >= input.moveLimit;
  if (seat === "opp") {
    if (facts.reconnectMsLeft != null && facts.reconnectMsLeft > 0) return plain(copy.reconnecting(formatClock(facts.reconnectMsLeft)));
    if (facts.goneForMs != null) return plain(copy.goneForShort(formatClock(facts.goneForMs)));
    if (facts.steppedOut) return plain(copy.STEPPED_OUT);
    return plain(copy.movesOf(facts.movesPlayed));
  }
  if (facts.offline) return plain(copy.OFFLINE);
  if (done) return plain(copy.movesOf(facts.movesPlayed));
  if (behind) return plain(copy.BEHIND_PACE, "seat");
  return plain(copy.compactMove(facts.movesPlayed + 1), isYourMove(input.moveState) ? "seat" : "muted");
}

function tableSub(input: ScoreboardInput, seat: Seat, copy: Copy): Sub {
  const table = input.table ?? { youSeated: false, oppSeated: false };
  if (input.phase === "table") {
    const seated = seat === "you" ? table.youSeated : table.oppSeated;
    return plain(seated ? copy.table.READY : seat === "you" ? copy.table.NOT_READY : copy.table.ON_THE_WAY);
  }
  if (seat === "opp") return plain(table.oppVoid === "left" ? copy.table.LEFT : table.oppVoid === "notSeated" ? copy.table.DID_NOT_SIT_DOWN : null);
  return plain(table.youRequeued ? copy.SEARCHING : null);
}

function subFor(input: ScoreboardInput, seat: Seat, behind: boolean, copy: Copy): Sub {
  if (input.review) {
    const moves = input[seat].movesPlayed;
    return plain(input.compact ? copy.review.movesOf(moves, input.moveLimit) : copy.review.atStep(moves, input.moveLimit, input.review.step));
  }
  if (input.phase === "table" || input.phase === "void") return tableSub(input, seat, copy);
  if (input.phase === "over") return plain(seat === "opp" && input.opp.left ? copy.rematch.HAS_LEFT : null);
  if (input.phase === "starting") return plain(copy.READY);
  if (input.compact) return compactSub(input, seat, behind, copy);
  return seat === "opp" ? oppSub(input, copy) : youSub(input, behind, copy);
}

function mutedFor(input: ScoreboardInput, seat: Seat, sub: Sub, copy: Copy): string {
  const facts = input[seat];
  if (input.review) return input.compact ? "" : String(facts.rating ?? copy.UNRATED);
  if (input.phase === "over" && facts.finalLine) return facts.finalLine;
  if (input.compact) return "";
  const rating = String(facts.rating ?? copy.UNRATED);
  // At the table both seats are named (canvas Table): `1187 · opponent`, `1204 · you`.
  if (input.phase === "table") return `${rating} · ${seat === "opp" ? copy.table.OPPONENT : copy.YOU}`;
  // Only your own row names its seat: the opponent's square and place already say
  // who they are, and their count needs the room (canvas Match, MatchLastMinute).
  if (input.readOnly || sub.alert || seat === "opp") return rating;
  return `${rating} · ${copy.YOU}`;
}

function rowFor(input: ScoreboardInput, seat: Seat, copy: Copy): PlayerRow {
  const facts = input[seat];
  const movesLeft = movesLeftOf(facts, input.moveLimit);
  const behind = seat === "you" && input.phase === "live" && behindPace(movesLeft, input.remainingMs);
  const sub = subFor(input, seat, behind, copy);
  const away = seat === "opp" ? facts.reconnectMsLeft != null || facts.goneForMs != null : Boolean(facts.offline);
  return {
    seat,
    name: facts.name,
    muted: mutedFor(input, seat, sub, copy),
    suffix: sub.suffix,
    tone: sub.tone,
    segments: segmentStates(facts.movesPlayed, input.moveLimit, facts.inFlight),
    laneMode: away && input.phase === "live" ? "outlined" : "moves",
    total: facts.score,
    showTotal: input.phase !== "table" && input.phase !== "void",
    movesLeft,
    behindPace: behind,
  };
}

export function deriveScoreboard(input: ScoreboardInput, copy: Copy): ScoreboardView {
  return { clock: clockRowFor(input, copy), opp: rowFor(input, "opp", copy), you: rowFor(input, "you", copy) };
}
