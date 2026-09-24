import "server-only";

import { z } from "zod";

import type { Language } from "@/lib/types/game-config";

import { startTableIfSeated, type TableDeps } from "./tableService";

/**
 * The only TypeScript door to making a match (spec 067 FR-016). Each wrapper
 * calls one of the database functions that end in create_match_between.
 */
export type MatchOrigin = "queue" | "challenge" | "crossed_challenge" | "rematch" | "crossed_rematch" | "link";

export type CreateMatchResult =
  | { status: "created"; matchId: string }
  | { status: "busy"; playerId: string }
  | { status: "not_pending" | "not_recipient" | "expired" | "not_completed" | "not_searching" | "gone" }
  | { status: "invalid"; reason: string };

type RpcClient = TableDeps["client"];

const replySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("created"), match_id: z.string(), seats: z.object({ a: z.boolean(), b: z.boolean() }).optional() }),
  z.object({ status: z.literal("busy"), player_id: z.string() }),
  z.object({ status: z.enum(["not_pending", "not_recipient", "expired", "not_completed", "not_searching", "gone"]) }),
  z.object({ status: z.literal("invalid"), reason: z.string() }),
]);

/** Spec 070: a challenge lasts 60s (owner decision §10 Q10). */
const DEFAULT_INVITE_TTL_SECONDS = 60;

export function inviteTtlSeconds(): number {
  return Number(process.env.PLAYTEST_INVITE_EXPIRY_SECONDS ?? DEFAULT_INVITE_TTL_SECONDS);
}

export function acceptInvite(
  client: RpcClient,
  input: { inviteId: string; actorId: string; origin?: "challenge" | "crossed_challenge" },
): Promise<CreateMatchResult> {
  const origin = input.origin ?? "challenge";
  return callCreation(client, "accept_invite", origin, {
    p_invite: input.inviteId,
    p_actor: input.actorId,
    p_ttl_seconds: inviteTtlSeconds(),
    p_origin: origin,
  });
}

export function acceptRematch(
  client: RpcClient,
  input: { requestId: string; actorId: string; origin?: "rematch" | "crossed_rematch" },
): Promise<CreateMatchResult> {
  const origin = input.origin ?? "rematch";
  return callCreation(client, "accept_rematch", origin, { p_request: input.requestId, p_actor: input.actorId, p_origin: origin });
}

export function pairFromQueue(
  client: RpcClient,
  input: { selfId: string; opponentId: string; language: Language },
): Promise<CreateMatchResult> {
  return callCreation(client, "pair_from_queue", "queue", { p_self: input.selfId, p_opponent: input.opponentId, p_language: input.language });
}

async function callCreation(client: RpcClient, fn: string, origin: MatchOrigin, args: Record<string, unknown>): Promise<CreateMatchResult> {
  const startedAt = performance.now();
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  const parsed = replySchema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn}: unexpected reply ${JSON.stringify(data)}`);
  const result = toResult(parsed.data);
  logCreation(origin, result, Math.round(performance.now() - startedAt));
  // Spec 069: a table both players sat at on creation (crossed presses, or both present) starts now.
  if (result.status === "created" && parsed.data.status === "created" && parsed.data.seats?.a && parsed.data.seats.b) {
    await startTableIfSeated({ client }, result.matchId);
  }
  return result;
}

function toResult(reply: z.infer<typeof replySchema>): CreateMatchResult {
  if (reply.status === "created") return { status: "created", matchId: reply.match_id };
  if (reply.status === "busy") return { status: "busy", playerId: reply.player_id };
  return reply;
}

function logCreation(origin: MatchOrigin, result: CreateMatchResult, ms: number): void {
  if (result.status === "created") {
    console.info(JSON.stringify({ event: "match.create", origin, matchId: result.matchId, ms }));
    return;
  }
  console.warn(JSON.stringify({ event: "match.create.refused", origin, reason: result.status, ms }));
}
