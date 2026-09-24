import { REMATCH_WINDOW_MS } from "@/lib/constants/rematch";
import type { MatchEndedReason, MatchPhase, MatchState, RematchOffer, RematchRefusal, RematchRequestView } from "@/lib/types/match";

import { expireDueRematches, pairCooldownUntil, playerOnMatch, presenceOf, requestOf, type RequestRow } from "./rematchService";

/** Everything the rematch offer is decided from, for one viewer (spec 071 R8). */
export interface RematchFacts {
  match: { state: MatchPhase; endedReason: MatchEndedReason | null | undefined; completedAt: string | null | undefined; playerAId: string; playerBId: string };
  viewerId: string;
  request: RematchRequestView | null;
  viewerOnMatch: boolean;
  opponentOnMatch: boolean;
  cooldownUntil: string | null;
  /** `presence_of`: present, away or gone. */
  opponentPresence: string;
}

const NOT_REMATCHABLE: ReadonlySet<string> = new Set(["void", "abandoned", "error"]);
const ENDED: ReadonlySet<string> = new Set(["declined", "expired", "withdrawn", "superseded"]);

/**
 * Pure: whether `rematch ▸` is offered to this viewer now, and why not (FR-010). It mirrors
 * `request_rematch`, which decides for real when the button is pressed.
 */
export function composeRematchOffer(facts: RematchFacts, nowMs: number): RematchOffer {
  const completedMs = Date.parse(facts.match.completedAt ?? "") || nowMs;
  const base = {
    request: facts.request,
    windowEndsAt: new Date(completedMs + REMATCH_WINDOW_MS).toISOString(),
    cooldownUntil: facts.cooldownUntil,
    opponentOnMatch: facts.opponentOnMatch,
    opponentHere: facts.opponentPresence === "present",
  };
  const reason = refusalOf(facts, nowMs, completedMs);
  return { ...base, offered: reason === null && facts.request === null, reason };
}

function refusalOf(facts: RematchFacts, nowMs: number, completedMs: number): RematchRefusal | null {
  const { match, request } = facts;
  if (match.state !== "completed" || NOT_REMATCHABLE.has(match.endedReason ?? "")) return "not_completed";
  if (request) return ENDED.has(request.status) ? (request.status as RematchRefusal) : null;
  if (nowMs > completedMs + REMATCH_WINDOW_MS) return "window_closed";
  if (!facts.viewerOnMatch) return "self_left";
  if (!facts.opponentOnMatch) return "opponent_left";
  return null;
}

type Client = Parameters<typeof requestOf>[0];

/**
 * The offer for the caller, read fresh. Never part of `loadMatchState`: that object is broadcast
 * to both players, and the offer (the cooldown above all) belongs to one of them.
 */
export async function readRematchOffer(client: Client, match: MatchState, viewerId: string, nowMs = Date.now()): Promise<RematchOffer | undefined> {
  if (match.state !== "completed") return undefined;
  const playerAId = match.players.playerA.playerId;
  const playerBId = match.players.playerB.playerId;
  if (viewerId !== playerAId && viewerId !== playerBId) return undefined;
  const opponentId = viewerId === playerAId ? playerBId : playerAId;
  const [first, viewerOnMatch, opponentOnMatch, opponentPresence] = await Promise.all([
    requestOf(client, match.matchId),
    playerOnMatch(client, viewerId, match.matchId),
    playerOnMatch(client, opponentId, match.matchId),
    presenceOf(client, opponentId),
  ]);
  // Lazy expiry (the sweep runs every 30s): only when this match's request is due or a player has left.
  const due = first?.status === "pending" && (Date.parse(first.expiresAt) <= nowMs || !viewerOnMatch || !opponentOnMatch);
  if (due) await expireDueRematches(client);
  const request = due ? await requestOf(client, match.matchId) : first;
  const cooldownUntil = await pairCooldownUntil(client, viewerId, opponentId);
  const facts = { match: { state: match.state, endedReason: match.endedReason, completedAt: match.completedAt, playerAId, playerBId }, viewerId, request: toView(request), viewerOnMatch, opponentOnMatch, cooldownUntil, opponentPresence };
  return composeRematchOffer(facts, nowMs);
}

function toView(row: RequestRow | null): RematchRequestView | null {
  return row ? { ...row } : null;
}
