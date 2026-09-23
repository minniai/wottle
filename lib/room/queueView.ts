import { QUEUE_CHECK_AT_MS, QUEUE_CHECK_DRAIN_MS } from "@/lib/constants/table";

/**
 * What the queue screen says (spec 069, game flow B7), derived from the
 * search's facts and the current time: searching, paused by a hidden tab,
 * the 3:00 `still searching?` check with its 30s drain, stopped when the check
 * goes unanswered, or the table-leave cooldown.
 */
export interface QueueViewInput {
  /** When the search began (the server's `queued_at`). */
  queuedAtMs: number;
  nowMs: number;
  paused: boolean;
  /** When the player last answered `keep searching ▸`; the next check counts from it. */
  checkAnsweredAtMs?: number | null;
  cooldownUntilMs?: number | null;
}

export type QueueView =
  | { kind: "searching"; elapsedMs: number }
  | { kind: "paused" }
  | { kind: "stillSearching"; elapsedMs: number; drain: number }
  | { kind: "stopped" }
  | { kind: "cooldown"; leftMs: number };

export function queueView(input: QueueViewInput): QueueView {
  const { nowMs } = input;
  if (input.cooldownUntilMs && input.cooldownUntilMs > nowMs) return { kind: "cooldown", leftMs: input.cooldownUntilMs - nowMs };
  if (input.paused) return { kind: "paused" };
  const elapsedMs = Math.max(0, nowMs - input.queuedAtMs);
  const sinceCheck = nowMs - Math.max(input.queuedAtMs, input.checkAnsweredAtMs ?? 0);
  if (sinceCheck >= QUEUE_CHECK_AT_MS + QUEUE_CHECK_DRAIN_MS) return { kind: "stopped" };
  if (sinceCheck >= QUEUE_CHECK_AT_MS) return { kind: "stillSearching", elapsedMs, drain: 1 - (sinceCheck - QUEUE_CHECK_AT_MS) / QUEUE_CHECK_DRAIN_MS };
  return { kind: "searching", elapsedMs };
}
