import "server-only";

import { z } from "zod";

import { acceptInvite } from "@/lib/match/createMatch";
import { startTableIfSeated } from "@/lib/match/tableService";
import { pokePlayer, pokePlayers } from "@/lib/realtime/pokes";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Challenges (spec 070 US3, research R7). The only TypeScript caller of
 * `send_challenge`, `withdraw_challenge` and `expire_challenges`, and the one
 * place a decline is written. The database decides every gate; this module
 * parses, pokes the other side and logs `challenge.*`.
 */
export type SendResult =
  | { status: "sent"; inviteId: string }
  | { status: "crossed"; matchId: string }
  | { status: "cooldown" | "declined_recently"; until: string }
  | { status: "in_match" | "gone" | "away" | "other_lobby" | "rate_limited" | "self" | "busy_sender" };

const sendReplySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("sent"), invite_id: z.string().uuid(), withdrawn_from: z.array(z.string().uuid()).nullable(), silenced: z.boolean() }),
  z.object({ status: z.literal("crossed"), match_id: z.string().uuid() }),
  z.object({ status: z.enum(["cooldown", "declined_recently"]), until: z.string() }),
  z.object({ status: z.enum(["in_match", "gone", "away", "other_lobby", "rate_limited", "self", "busy_sender"]) }),
]);

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

export async function sendChallenge(senderId: string, recipientId: string): Promise<SendResult> {
  const client = getServiceRoleClient();
  const { data, error } = await client.rpc("send_challenge", { p_sender: senderId, p_recipient: recipientId });
  if (error) throw new Error(`send_challenge: ${error.message}`);
  const reply = sendReplySchema.parse(data);
  switch (reply.status) {
    case "sent":
      log("challenge.sent", { senderId, recipientId, silenced: reply.silenced });
      await Promise.all([reply.silenced ? pokePlayer(senderId, "outcome") : pokePlayer(recipientId, "challenge"), pokePlayers(reply.withdrawn_from ?? [], "outcome")]);
      return { status: "sent", inviteId: reply.invite_id };
    case "crossed":
      log("challenge.crossed", { senderId, recipientId, matchId: reply.match_id });
      await startTableIfSeated({ client }, reply.match_id);
      await pokePlayers([senderId, recipientId], "table");
      return { status: "crossed", matchId: reply.match_id };
    case "cooldown":
    case "declined_recently":
      log("challenge.refused", { senderId, reason: reply.status });
      return { status: reply.status, until: reply.until };
    default:
      log("challenge.refused", { senderId, reason: reply.status });
      return { status: reply.status };
  }
}

const withdrawReplySchema = z.union([
  z.object({ status: z.literal("withdrawn"), recipient_id: z.string().uuid() }),
  z.object({ status: z.literal("not_pending") }),
]);

export async function withdrawChallenge(senderId: string, inviteId: string): Promise<{ status: "withdrawn" | "not_pending" }> {
  const { data, error } = await getServiceRoleClient().rpc("withdraw_challenge", { p_sender: senderId, p_invite: inviteId });
  if (error) throw new Error(`withdraw_challenge: ${error.message}`);
  const reply = withdrawReplySchema.parse(data);
  if (reply.status === "withdrawn") {
    log("challenge.withdrawn", { senderId, inviteId });
    await pokePlayer(reply.recipient_id, "outcome");
  }
  return { status: reply.status };
}

export type RespondResult =
  | { status: "accepted"; matchId: string }
  | { status: "declined" }
  | { status: "sender_busy" | "sender_gone" | "expired" | "not_pending" };

/** The players whose challenges a new match just ended (withdrawn or superseded): each hears of it. */
async function pokeEndedSince(playerIds: string[], since: string): Promise<void> {
  const list = playerIds.join(",");
  const { data } = await getServiceRoleClient()
    .from("match_invitations")
    .select("sender_id, recipient_id")
    .in("status", ["withdrawn", "superseded"])
    .gte("responded_at", since)
    .or(`sender_id.in.(${list}),recipient_id.in.(${list})`);
  const others = (data ?? []).flatMap((r) => [r.sender_id as string, r.recipient_id as string]).filter((id) => !playerIds.includes(id));
  await pokePlayers(others, "outcome");
}

async function accept(actorId: string, inviteId: string): Promise<RespondResult> {
  const client = getServiceRoleClient();
  const { data: invite } = await client.from("match_invitations").select("sender_id").eq("id", inviteId).maybeSingle();
  const since = new Date().toISOString();
  const result = await acceptInvite(client, { inviteId, actorId });
  const senderId = (invite?.sender_id as string | undefined) ?? null;
  if (result.status === "created") {
    log("challenge.accepted", { actorId, inviteId, matchId: result.matchId });
    await Promise.all([pokePlayers([actorId, ...(senderId ? [senderId] : [])], "table"), senderId ? pokeEndedSince([actorId, senderId], since) : undefined]);
    return { status: "accepted", matchId: result.matchId };
  }
  if (senderId) await pokePlayer(senderId, "outcome");
  if (result.status === "busy") return { status: "sender_busy" };
  if (result.status === "gone") return { status: "sender_gone" };
  if (result.status === "expired") return { status: "expired" };
  return { status: "not_pending" };
}

async function decline(actorId: string, inviteId: string): Promise<RespondResult> {
  const { data } = await getServiceRoleClient()
    .from("match_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("recipient_id", actorId)
    .eq("status", "pending")
    .select("sender_id")
    .maybeSingle();
  if (!data) return { status: "not_pending" };
  log("challenge.declined", { actorId, inviteId });
  await pokePlayer(data.sender_id as string, "outcome");
  return { status: "declined" };
}

export function respondChallenge(actorId: string, inviteId: string, answer: "accept" | "decline"): Promise<RespondResult> {
  return answer === "accept" ? accept(actorId, inviteId) : decline(actorId, inviteId);
}

const expiredRowSchema = z.object({ invite_id: z.string().uuid(), sender_id: z.string().uuid(), recipient_id: z.string().uuid() });

/** The sweep's step (FR-036): challenges past their 60s end as `no answer`, and both sides hear of it. */
export async function expireChallenges(): Promise<number> {
  const { data, error } = await getServiceRoleClient().rpc("expire_challenges");
  if (error) throw new Error(`expire_challenges: ${error.message}`);
  const rows = z.array(expiredRowSchema).parse(data ?? []);
  if (rows.length > 0) {
    log("challenge.expired", { count: rows.length });
    await pokePlayers(rows.flatMap((r) => [r.sender_id, r.recipient_id]), "outcome");
  }
  return rows.length;
}

/** Starting a search withdraws the player's challenge (§7.5 invariant 3); its recipient hears of it. */
export async function withdrawOutgoing(senderId: string): Promise<void> {
  const { data } = await getServiceRoleClient()
    .from("match_invitations")
    .update({ status: "withdrawn", responded_at: new Date().toISOString() })
    .eq("sender_id", senderId)
    .eq("status", "pending")
    .select("recipient_id");
  const recipients = (data ?? []).map((r) => r.recipient_id as string);
  if (recipients.length > 0) {
    log("challenge.withdrawn", { senderId, by: "search" });
    await pokePlayers(recipients, "outcome");
  }
}
