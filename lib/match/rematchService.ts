import { z } from "zod";

import type { RematchRefusal, RematchRequestStatus, SeriesContext } from "@/lib/types/match";

import { startTableIfSeated, type TableDeps } from "./tableService";

/**
 * Spec 071: the one TypeScript door to the rematch functions (R6). The database decides every
 * rule (the 2:00 window, both players on the match, one request per match, 30s, the cooldown);
 * this module calls it, parses the reply and says what happened.
 */
type Client = TableDeps["client"];

const REFUSALS = [
  "not_completed", "not_participant", "window_closed", "opponent_left", "self_left",
  "already_requested", "declined", "expired", "withdrawn", "superseded", "busy",
] as const satisfies readonly RematchRefusal[];

const requestReply = z.discriminatedUnion("status", [
  z.object({ status: z.literal("sent"), request_id: z.string(), expires_at: z.string() }),
  z.object({ status: z.literal("accepted"), new_match_id: z.string() }),
  z.object({ status: z.literal("refused"), reason: z.enum(REFUSALS) }),
]);

export type RequestRematchResult =
  | { status: "sent"; requestId: string; expiresAt: string }
  | { status: "accepted"; newMatchId: string }
  | { status: "refused"; reason: RematchRefusal };

async function rpc<T>(client: Client, fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn}: unexpected reply ${JSON.stringify(data)}`);
  return parsed.data;
}

/** Ask for a rematch; a press that crosses the other player's request starts the match at once. */
export async function requestRematch(client: Client, matchId: string, actorId: string): Promise<RequestRematchResult> {
  const reply = await rpc(client, "request_rematch", { p_match: matchId, p_actor: actorId }, requestReply);
  if (reply.status === "sent") return { status: "sent", requestId: reply.request_id, expiresAt: reply.expires_at };
  if (reply.status === "refused") return reply;
  // Both pressed, so both are seated: the table starts now (spec 069).
  await startTableIfSeated({ client }, reply.new_match_id);
  return { status: "accepted", newMatchId: reply.new_match_id };
}

const endReply = z.object({ status: z.string(), reason: z.string().optional() });

export async function declineRematch(client: Client, requestId: string, actorId: string): Promise<{ status: "declined" | "expired" | "refused" }> {
  const reply = await rpc(client, "decline_rematch", { p_request: requestId, p_actor: actorId }, endReply);
  return { status: reply.status === "declined" || reply.status === "expired" ? reply.status : "refused" };
}

/** The requester withdraws (`withdrawn`); the recipient leaving for a new opponent or the lobby supersedes it. */
export async function withdrawRematch(client: Client, requestId: string, actorId: string): Promise<{ status: "withdrawn" | "superseded" | "refused" }> {
  const reply = await rpc(client, "withdraw_rematch", { p_request: requestId, p_actor: actorId }, endReply);
  return { status: reply.status === "withdrawn" || reply.status === "superseded" ? reply.status : "refused" };
}

/** Requests past their 30s, or whose players have left the match; returns the matches to poke. */
export async function expireDueRematches(client: Client): Promise<string[]> {
  return (await rpc(client, "expire_due_rematches", {}, z.array(z.string()).nullable())) ?? [];
}

export async function pairCooldownUntil(client: Client, senderId: string, recipientId: string): Promise<string | null> {
  return rpc(client, "pair_cooldown_until", { p_sender: senderId, p_recipient: recipientId }, z.string().nullable());
}

export async function playerOnMatch(client: Client, playerId: string, matchId: string): Promise<boolean> {
  return rpc(client, "player_on_match", { p_player: playerId, p_match: matchId }, z.boolean());
}

export interface SeriesRow {
  matchId: string;
  winnerId: string | null;
  ordinal: number;
}

export async function rematchSeries(client: Client, matchId: string): Promise<SeriesRow[]> {
  const rows = await rpc(client, "rematch_series", { p_match: matchId }, z.array(z.object({ match_id: z.string(), winner_id: z.string().nullable(), ordinal: z.number() })));
  return rows.map((r) => ({ matchId: r.match_id, winnerId: r.winner_id, ordinal: r.ordinal }));
}

export interface PendingRequest {
  id: string;
  requesterId: string;
  responderId: string;
}

/** The match's request while it is pending; there is at most one per match. */
export async function pendingRequestOf(client: Client, matchId: string): Promise<PendingRequest | null> {
  const { data, error } = await client.from("rematch_requests").select("id, requester_id, responder_id, status").eq("match_id", matchId).maybeSingle();
  if (error) throw new Error(`rematch_requests: ${error.message}`);
  if (!data || data.status !== "pending") return null;
  return { id: data.id as string, requesterId: data.requester_id as string, responderId: data.responder_id as string };
}

export interface RequestRow {
  id: string;
  requesterId: string;
  status: RematchRequestStatus;
  createdAt: string;
  expiresAt: string;
  newMatchId: string | null;
}

export async function requestOf(client: Client, matchId: string): Promise<RequestRow | null> {
  const { data, error } = await client.from("rematch_requests").select("id, requester_id, status, created_at, expires_at, new_match_id").eq("match_id", matchId).maybeSingle();
  if (error) throw new Error(`rematch_requests: ${error.message}`);
  if (!data) return null;
  return { id: data.id, requesterId: data.requester_id, status: data.status, createdAt: data.created_at, expiresAt: data.expires_at, newMatchId: data.new_match_id };
}

/** The two players of a match, to poke both. */
export async function matchPlayers(client: Client, matchId: string): Promise<[string, string]> {
  const { data, error } = await client.from("matches").select("player_a_id, player_b_id").eq("id", matchId).single();
  if (error || !data) throw new Error(`matches: ${error?.message ?? "not found"}`);
  return [data.player_a_id as string, data.player_b_id as string];
}

export async function presenceOf(client: Client, playerId: string): Promise<string> {
  return rpc(client, "presence_of", { p_player: playerId }, z.string());
}

interface MatchChainEntry {
  id: string;
  rematchOf: string | null;
  winnerId: string | null;
}

/**
 * Walks the rematch_of chain backward from the given match to find all
 * matches in the series. Returns match IDs from oldest to newest.
 */
export function walkRematchChain(
  matches: MatchChainEntry[],
  startMatchId: string,
): string[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const chain: string[] = [];
  let current = startMatchId;

  // Walk backward through rematch_of links
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    chain.unshift(current);
    const match = byId.get(current);
    if (!match?.rematchOf) break;
    current = match.rematchOf;
  }

  return chain;
}

/**
 * Derives series context (game number, wins) from a chain of matches.
 */
export function deriveSeriesContext(
  matches: MatchChainEntry[],
  chain: string[],
  currentPlayerId: string,
): SeriesContext {
  const byId = new Map(matches.map((m) => [m.id, m]));

  let currentPlayerWins = 0;
  let opponentWins = 0;
  let draws = 0;

  for (const matchId of chain) {
    const match = byId.get(matchId);
    if (!match) continue;
    if (match.winnerId === null) {
      draws++;
    } else if (match.winnerId === currentPlayerId) {
      currentPlayerWins++;
    } else {
      opponentWins++;
    }
  }

  return {
    gameNumber: chain.length,
    currentPlayerWins,
    opponentWins,
    draws,
  };
}
