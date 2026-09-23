import type { Copy } from "@/lib/i18n/copy/types";
import { SLIP_LIFT_BEFORE_GO_MS, TABLE_SEAT_WINDOW_MS } from "@/lib/constants/table";
import type { MatchState, PlayerSlot, SeatKey } from "@/lib/types/match";

import { formatClock } from "./clock";
import type { SlipState } from "./slip";

/**
 * The table's slips (spec 069, game flow C1–C3): derived from the match state
 * and the server-corrected time, never stored. The ready slip stands over the
 * empty field until 3.3s before go; the void slip replaces it when the table
 * never filled or someone left.
 */
export interface TableSlipInput {
  match: MatchState;
  viewerSlot: PlayerSlot;
  you: { name: string; rating: number | null };
  opp: { name: string; rating: number | null };
  /** Server-corrected epoch ms. */
  nowMs: number;
  copy: Copy;
}

export interface TableSeatLine {
  seat: "you" | "opp";
  name: string;
  status: string;
  seated: boolean;
}

export interface ReadySlipModel {
  label: string;
  headline: { name: string; rating: number | null };
  facts: string;
  stakes: string | null;
  seats: TableSeatLine[];
  actions: "ready+leave" | "seated+leave" | "none";
  /** What is left of the 20s, 1 → 0; null once the start is set. */
  drain: number | null;
}

export type VoidAction = "cancelQueue" | "challengeAgain" | "result" | "lobby";

export interface VoidSlipModel {
  label: string;
  headline: string;
  body: string[];
  actions: VoidAction[];
  /** The viewer is back in the queue, at the front: the slip keeps searching (FR-017). */
  requeued: boolean;
  /** The requeued search as it runs (`searching · 0:03`); the controller fills it in. */
  searching?: string | null;
}

/** The match clock's length before the server has set it: 5:00 (spec 050). */
const DEFAULT_CLOCK_MS = 300_000;
/** The count the slip shows once the start is set; the scoreboard carries it on (C2). */
const SLIP_COUNT = 3;

function seatKeys(viewerSlot: PlayerSlot): { you: SeatKey; opp: SeatKey } {
  return viewerSlot === "player_a" ? { you: "a", opp: "b" } : { you: "b", opp: "a" };
}

function viewerIdOf(input: TableSlipInput): string {
  return input.match.players[input.viewerSlot === "player_a" ? "playerA" : "playerB"].playerId;
}

function msUntil(iso: string | null, nowMs: number): number {
  return iso ? Date.parse(iso) - nowMs : 0;
}

function seatLines(input: TableSlipInput): TableSeatLine[] {
  const { match, copy } = input;
  const keys = seatKeys(input.viewerSlot);
  const status = (seated: boolean) => (seated ? copy.table.READY : copy.table.ON_THE_WAY);
  const oppSeated = match.table.seats[keys.opp] !== null;
  const youSeated = match.table.seats[keys.you] !== null;
  return [
    { seat: "opp", name: input.opp.name, status: status(oppSeated), seated: oppSeated },
    { seat: "you", name: copy.table.seatYou(input.you.name), status: status(youSeated), seated: youSeated },
  ];
}

function stakesLine(input: TableSlipInput): string | null {
  const stakes = input.match.stakes?.[viewerIdOf(input)];
  return stakes ? input.copy.table.stakes(stakes.win, stakes.draw, stakes.loss) : null;
}

function labelFor(input: TableSlipInput, secondsLeft: number): string {
  const { match, copy } = input;
  if (match.state !== "pending") {
    return copy.startsIn(Math.min(SLIP_COUNT, Math.max(1, Math.ceil(msUntil(match.clock.startedAt, input.nowMs) / 1000))));
  }
  return copy.table.label(formatClock(secondsLeft * 1000));
}

export function readySlipModel(input: TableSlipInput): ReadySlipModel {
  const { match, copy } = input;
  const pending = match.state === "pending";
  const leftMs = Math.max(0, msUntil(match.table.deadlineAt, input.nowMs));
  const secondsLeft = Math.ceil(leftMs / 1000);
  const seats = seatLines(input);
  const youSeated = seats[1].seated;
  return {
    label: labelFor(input, secondsLeft),
    headline: { name: input.opp.name, rating: input.opp.rating },
    facts: copy.table.facts(copy.LANGUAGE_WORDS, match.moveLimit, formatClock(DEFAULT_CLOCK_MS)),
    stakes: stakesLine(input),
    seats,
    actions: !pending ? "none" : youSeated ? "seated+leave" : "ready+leave",
    drain: pending ? secondsLeft / (TABLE_SEAT_WINDOW_MS / 1000) : null,
  };
}

function voidHeadline(input: TableSlipInput, viewerId: string): string {
  const { table } = input.match;
  const { copy } = input;
  if (table.voidReason === "left") return table.voidedBy === viewerId ? copy.table.YOU_LEFT : copy.table.voidOppLeft(input.opp.name);
  // Not seated: the one who did not sit down is named; when neither did, it is the viewer too.
  return table.voidedBy && table.voidedBy !== viewerId ? copy.table.voidOppNotSeated(input.opp.name) : copy.table.VOID_YOU_NOT_SEATED;
}

function voidActions(origin: string | null, requeued: boolean): VoidAction[] {
  if (requeued) return ["cancelQueue"];
  if (origin === "challenge" || origin === "crossed_challenge") return ["challengeAgain", "lobby"];
  if (origin === "rematch" || origin === "crossed_rematch") return ["result", "lobby"];
  return ["lobby"];
}

/** Nothing was rated, and why (spec 069 C3); a seated searcher is back in the queue. */
export function voidSlipModel(input: TableSlipInput): VoidSlipModel {
  const { match, copy } = input;
  const viewerId = viewerIdOf(input);
  const seated = match.table.seats[seatKeys(input.viewerSlot).you] !== null;
  const requeued = match.table.origin === "queue" && seated && match.table.voidedBy !== viewerId;
  return {
    label: copy.table.VOID_LABEL,
    headline: voidHeadline(input, viewerId),
    body: requeued ? [copy.table.NOTHING_RATED, copy.table.BACK_IN_QUEUE] : [copy.table.NOTHING_RATED],
    actions: voidActions(match.table.origin, requeued),
    requeued,
  };
}

/** The ready slip while the table stands, until 3.3s before go (FR-010); the void slip after a void. */
export function tableSlipFor(input: TableSlipInput): SlipState | null {
  const { match } = input;
  if (match.state === "completed" && match.endedReason === "void") return { kind: "void", model: voidSlipModel(input) };
  if (match.state === "pending") return { kind: "ready", model: readySlipModel(input) };
  if (match.state === "in_progress" && msUntil(match.clock.startedAt, input.nowMs) > SLIP_LIFT_BEFORE_GO_MS) {
    return { kind: "ready", model: readySlipModel(input) };
  }
  return null;
}
