import type { Copy } from "@/lib/i18n/copy/types";
import type { RematchOffer, RematchRequestView } from "@/lib/types/match";

import { formatClock } from "./clock";

/** Spec 071 (D2): what the slip's action row 1, or the ledger's first line, says about a rematch. */
export type RematchView =
  | { kind: "offered" }
  | { kind: "sent"; line: string; secondsLeft: number; drain: number }
  | { kind: "incoming"; line: string; secondsLeft: number; drain: number }
  | { kind: "closed"; line: string | null; challengeAgain: ChallengeAgain | null }
  | { kind: "accepted"; line: string; newMatchId: string };

export interface ChallengeAgain {
  enabled: boolean;
  /** `challenge again ▸`, or `again in 0:52` while the pair's cooldown runs. */
  label: string;
}

export interface RematchViewInput {
  offer: RematchOffer;
  viewerId: string;
  opponentName: string;
  nowMs: number;
}

const REQUEST_MS = 30_000;

/**
 * The client never decides a rematch: it draws the server's offer at `nowMs`. A request at
 * 0:00 stays drawn at 0:00 until the next state read says how it ended.
 */
export function deriveRematchView(input: RematchViewInput, copy: Copy): RematchView {
  const { offer, viewerId, opponentName } = input;
  const request = offer.request;
  if (request?.status === "pending") return pendingView(request, input, copy);
  if (request?.status === "accepted" && request.newMatchId) return { kind: "accepted", line: copy.rematch.accepted(opponentName), newMatchId: request.newMatchId };
  if (offer.offered) return { kind: "offered" };
  const line = request ? endedLine(request, viewerId, opponentName, copy) : reasonLine(offer, opponentName, copy);
  return { kind: "closed", line, challengeAgain: challengeAgainOf(offer, input.nowMs, copy) };
}

function pendingView(request: RematchRequestView, { viewerId, opponentName, nowMs }: RematchViewInput, copy: Copy): RematchView {
  const leftMs = Math.max(0, Date.parse(request.expiresAt) - nowMs);
  const secondsLeft = Math.ceil(leftMs / 1000);
  const clock = formatClock(secondsLeft * 1000);
  const drain = secondsLeft / (REQUEST_MS / 1000);
  return request.requesterId === viewerId
    ? { kind: "sent", line: copy.rematch.sent(clock), secondsLeft, drain }
    : { kind: "incoming", line: copy.rematch.asks(opponentName, clock), secondsLeft, drain };
}

/** How the request ended, told to the one it happened to; the one who ended it reads nothing. */
function endedLine(request: RematchRequestView, viewerId: string, opponentName: string, copy: Copy): string | null {
  const mine = request.requesterId === viewerId;
  switch (request.status) {
    case "declined":
      return mine ? copy.rematch.declined(opponentName) : null;
    case "expired":
      return copy.rematch.NO_ANSWER;
    case "withdrawn":
      return mine ? null : copy.rematch.withdrew(opponentName);
    case "superseded":
      return mine ? copy.rematch.startedAnother(opponentName) : null;
    default:
      return null;
  }
}

function reasonLine(offer: RematchOffer, opponentName: string, copy: Copy): string | null {
  return offer.reason === "opponent_left" ? copy.rematch.hasLeft(opponentName) : null;
}

function challengeAgainOf(offer: RematchOffer, nowMs: number, copy: Copy): ChallengeAgain | null {
  if (!offer.opponentHere) return null;
  const leftMs = offer.cooldownUntil ? Date.parse(offer.cooldownUntil) - nowMs : 0;
  if (leftMs <= 0) return { enabled: true, label: copy.table.CHALLENGE_AGAIN };
  return { enabled: false, label: copy.pages.againIn(formatClock(Math.ceil(leftMs / 1000) * 1000)) };
}
