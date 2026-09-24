import "server-only";

import { z } from "zod";

import { LINK_TTL_MS } from "@/lib/constants/links";
import { acceptLink as acceptLinkMatch, type CreateMatchResult } from "@/lib/match/createMatch";
import { pokePlayer, pokePlayers } from "@/lib/realtime/pokes";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LinkView } from "@/lib/types/link";

import { toByteaHex } from "./linkToken";

/**
 * Invite links (spec 072). The only TypeScript caller of `create_link`,
 * `read_link`, `cancel_link` and `expire_links`; `accept_link` goes through
 * `lib/match/createMatch.ts` with the other ways to make a match. The database
 * decides every gate; this module parses, pokes and logs `link.*`. A token or
 * its hash is never logged.
 */
export type CreateOutcome =
  | { status: "created"; linkId: string; expiresAt: string; language: "is" | "en" }
  | { status: "cooldown"; until: string }
  | { status: "busy_sender" | "rate_limited" | "invalid" };

export type AcceptOutcome =
  | { status: "created"; matchId: string; senderId: string }
  | { status: "expired" | "own" | "busy" };

const createReply = z.discriminatedUnion("status", [
  z.object({ status: z.literal("created"), link_id: z.string().uuid(), expires_at: z.string(), language: z.enum(["is", "en"]), withdrawn_from: z.array(z.string().uuid()).nullable() }),
  z.object({ status: z.literal("cooldown"), until: z.string() }),
  z.object({ status: z.enum(["busy_sender", "rate_limited", "invalid"]) }),
]);

const readReply = z.union([
  z.object({
    found: z.literal(true),
    valid: z.boolean(),
    link_id: z.string().uuid(),
    sender_id: z.string().uuid(),
    sender_name: z.string(),
    sender_handle: z.string(),
    sender_rating: z.number(),
    language: z.enum(["is", "en"]),
    expires_at: z.string(),
  }),
  z.object({ found: z.literal(false), valid: z.literal(false) }),
]);

const cancelReply = z.object({ status: z.enum(["cancelled", "not_pending"]) });
const expiredRows = z.array(z.object({ link_id: z.string().uuid(), sender_id: z.string().uuid() }));

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

export async function createLink(senderId: string, tokenHash: Buffer): Promise<CreateOutcome> {
  const { data, error } = await getServiceRoleClient().rpc("create_link", {
    p_sender: senderId,
    p_token_hash: toByteaHex(tokenHash),
    p_ttl_seconds: Math.round(LINK_TTL_MS / 1000),
  });
  if (error) throw new Error(`create_link: ${error.message}`);
  const reply = createReply.parse(data);
  if (reply.status !== "created") {
    log("link.refused", { senderId, reason: reply.status });
    return reply.status === "cooldown" ? { status: "cooldown", until: reply.until } : { status: reply.status };
  }
  log("link.created", { senderId, linkId: reply.link_id });
  await Promise.all([pokePlayer(senderId, "link"), pokePlayers(reply.withdrawn_from ?? [], "outcome")]);
  return { status: "created", linkId: reply.link_id, expiresAt: reply.expires_at, language: reply.language };
}

/** Reads a link; writes nothing (research R4). Null when no link has this hash. */
export async function readLink(tokenHash: Buffer): Promise<LinkView | null> {
  const { data, error } = await getServiceRoleClient().rpc("read_link", { p_token_hash: toByteaHex(tokenHash) });
  if (error) throw new Error(`read_link: ${error.message}`);
  const reply = readReply.parse(data);
  if (!reply.found) return null;
  return {
    valid: reply.valid,
    senderId: reply.sender_id,
    senderName: reply.sender_name,
    senderHandle: reply.sender_handle,
    senderRating: reply.sender_rating,
    language: reply.language,
    expiresAt: reply.expires_at,
  };
}

export async function acceptLink(tokenHash: Buffer, actorId: string, senderId: string): Promise<AcceptOutcome> {
  const startedAt = performance.now();
  const result: CreateMatchResult = await acceptLinkMatch(getServiceRoleClient(), { tokenHashHex: toByteaHex(tokenHash), actorId });
  const ms = Math.round(performance.now() - startedAt);
  if (result.status === "created") {
    log("link.accepted", { actorId, senderId, matchId: result.matchId, ms });
    await Promise.all([pokePlayers([actorId, senderId], "table"), pokePlayer(senderId, "link")]);
    return { status: "created", matchId: result.matchId, senderId };
  }
  const status = result.status === "own" ? "own" : result.status === "busy" ? "busy" : "expired";
  log("link.accept_refused", { actorId, reason: status, ms });
  return { status };
}

export async function cancelLink(senderId: string, linkId: string): Promise<{ status: "cancelled" | "not_pending" }> {
  const { data, error } = await getServiceRoleClient().rpc("cancel_link", { p_sender: senderId, p_link: linkId });
  if (error) throw new Error(`cancel_link: ${error.message}`);
  const reply = cancelReply.parse(data);
  if (reply.status === "cancelled") {
    log("link.cancelled", { senderId, linkId });
    await pokePlayer(senderId, "link");
  }
  return reply;
}

/** The sweep's step: every overdue link ends, and its sender hears of it. */
export async function expireDueLinks(): Promise<number> {
  const { data, error } = await getServiceRoleClient().rpc("expire_links");
  if (error) throw new Error(`expire_links: ${error.message}`);
  const rows = expiredRows.parse(data ?? []);
  if (rows.length > 0) {
    log("link.expired", { count: rows.length });
    await pokePlayers(rows.map((r) => r.sender_id), "link");
  }
  return rows.length;
}
