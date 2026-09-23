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

export type ScoreboardPhase = "starting" | "live" | "over";

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
  /** The viewer's own transport has lost the match. */
  offline?: boolean;
  /** Match over: the rating line (`1204 → 1212 · +8 · wins`, or `rating pending`). */
  finalLine?: string;
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
  you: ScoreboardSeat;
  opp: ScoreboardSeat;
}

export type ScoreboardClockPhase = ClockRowPhase | "starting" | "over";

export interface ClockRow {
  phase: ScoreboardClockPhase;
  /** The phase in words: `match clock`, `under a minute`, `last 12s`, `time`, `starts in 3`, `match over`. */
  label: string;
  /** Under the label: the pace while the move is yours, or the match's length at the end; "" otherwise. */
  detail: string;
  numeral: string;
  ticksLeft: number;
  blocks: number[];
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

function clockRowFor(input: ScoreboardInput, copy: Copy): ClockRow {
  if (input.phase === "starting") {
    const ticks = startingTicks(input.msToStart ?? 0);
    const label = copy.startsIn(Math.max(1, Math.ceil((input.msToStart ?? 0) / 1000)));
    return { phase: "starting", label, detail: "", numeral: formatClock(input.clockLengthMs), ticksLeft: ticks, blocks: clockBlocks(ticks) };
  }
  const ticks = ticksLeft(input.remainingMs);
  const numeral = formatClock(input.remainingMs);
  if (input.phase === "over") {
    const detail = copy.clockOfLength(formatClock(input.elapsedMs ?? input.clockLengthMs - input.remainingMs), formatClock(input.clockLengthMs));
    return { phase: "over", label: copy.MATCH_OVER, detail, numeral, ticksLeft: ticks, blocks: clockBlocks(ticks) };
  }
  const phase = clockRowPhase(input.remainingMs);
  return { phase, label: liveLabel(input, phase, copy), detail: liveDetail(input, phase, copy), numeral, ticksLeft: ticks, blocks: clockBlocks(ticks) };
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

function subFor(input: ScoreboardInput, seat: Seat, behind: boolean, copy: Copy): Sub {
  if (input.phase === "over") return plain(null);
  if (input.phase === "starting") return plain(copy.READY);
  return seat === "opp" ? oppSub(input, copy) : youSub(input, behind, copy);
}

function mutedFor(input: ScoreboardInput, seat: Seat, sub: Sub, copy: Copy): string {
  const facts = input[seat];
  if (input.phase === "over" && facts.finalLine) return facts.finalLine;
  const rating = String(facts.rating ?? copy.UNRATED);
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
    movesLeft,
    behindPace: behind,
  };
}

export function deriveScoreboard(input: ScoreboardInput, copy: Copy): ScoreboardView {
  return { clock: clockRowFor(input, copy), opp: rowFor(input, "opp", copy), you: rowFor(input, "you", copy) };
}
