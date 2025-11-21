import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { LobbyStatus, PlayerIdentity } from "../types/match";
import { bootstrapMatchRecord, findActiveMatchForPlayer } from "./service";
import { logPlaytestError, logPlaytestInfo, trackInviteAccepted } from "../observability/log";

type AnyClient = SupabaseClient<any, any, any>;

const DEFAULT_INVITE_TTL_SECONDS = Number(
  process.env.PLAYTEST_INVITE_EXPIRY_SECONDS ?? "30"
);
const DEFAULT_QUEUE_WAIT_SECONDS = Number(
  process.env.PLAYTEST_QUEUE_WAIT_SECONDS ?? "15"
);

export interface SendDirectInviteParams {
  senderId: string;
  recipientId: string;
  ttlSeconds?: number;
}

export interface SendDirectInviteResult {
  inviteId: string;
  expiresAt: string;
}

export interface RespondInviteParams {
  inviteId: string;
  actorId: string;
  decision: "accepted" | "declined";
}

export interface RespondInviteResult {
  status: "accepted" | "declined";
  matchId?: string;
}

export interface PendingInviteSummary {
  id: string;
  sender: Pick<PlayerIdentity, "id" | "username" | "displayName">;
  expiresAt: string;
}

export interface StartQueueParams {
  playerId: string;
}

export interface QueueResult {
  status: "queued" | "matched";
  matchId?: string;
  estimatedWaitSeconds?: number;
}

interface InviteRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  responded_at: string | null;
  match_id: string | null;
}

interface QueueCandidate {
  id: string;
  username: string;
  last_seen_at: string;
}

export function calculateInviteExpiry(
  now = new Date(),
  ttlSeconds = DEFAULT_INVITE_TTL_SECONDS
): string {
  return new Date(now.getTime() + ttlSeconds * 1_000).toISOString();
}

export function isInviteExpired(
  createdAt: string,
  now = new Date(),
  ttlSeconds = DEFAULT_INVITE_TTL_SECONDS
): boolean {
  const created = Date.parse(createdAt);
  return now.getTime() - created >= ttlSeconds * 1_000;
}

export function selectQueueOpponent<T extends { id: string; lastSeenAt: string }>(
  candidates: T[],
  selfId: string
): T | null {
  const filtered = candidates.filter((candidate) => candidate.id !== selfId);
  if (filtered.length === 0) {
    return null;
  }
  return filtered.sort(
    (a, b) => Date.parse(a.lastSeenAt) - Date.parse(b.lastSeenAt)
  )[0];
}

export async function sendDirectInvite(
  client: AnyClient,
  params: SendDirectInviteParams
): Promise<SendDirectInviteResult> {
  if (params.senderId === params.recipientId) {
    throw new Error("You cannot invite yourself.");
  }

  const ttlSeconds = params.ttlSeconds ?? DEFAULT_INVITE_TTL_SECONDS;
  const expiresAt = calculateInviteExpiry(new Date(), ttlSeconds);

  const recipient = await fetchPlayer(client, params.recipientId);
  if (!recipient) {
    throw new Error("Recipient not found.");
  }
  if (recipient.status !== "available") {
    throw new Error("Recipient is unavailable right now.");
  }

  const existing = await client
    .from("match_invitations")
    .select("id")
    .eq("sender_id", params.senderId)
    .eq("recipient_id", params.recipientId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing.data) {
    throw new Error("An invite is already pending for that tester.");
  }
  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const { data, error } = await client
    .from("match_invitations")
    .insert({
      sender_id: params.senderId,
      recipient_id: params.recipientId,
      status: "pending",
    })
    .select("id,created_at")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Unable to create invitation at this time."
    );
  }

  await setPlayerStatus(client, params.senderId, "matchmaking");
  await updatePresenceMode(client, params.senderId, {
    mode: "direct_invite",
    inviteToken: data.id,
  });

  logPlaytestInfo("matchmaking.invite.sent", {
    playerId: params.senderId,
    metadata: { recipientId: params.recipientId },
  });

  return {
    inviteId: data.id,
    expiresAt,
  };
}

export async function respondToInvite(
  client: AnyClient,
  params: RespondInviteParams
): Promise<RespondInviteResult> {
  const invite = await fetchInvite(client, params.inviteId);
  if (!invite) {
    throw new Error("Invite not found.");
  }
  if (invite.status !== "pending") {
    throw new Error("Invite is no longer active.");
  }
  if (invite.recipient_id !== params.actorId) {
    throw new Error("You cannot respond to this invite.");
  }

  if (params.decision === "declined") {
    await client
      .from("match_invitations")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", params.inviteId);

    await setPlayerStatus(client, invite.sender_id, "available");
    await updatePresenceMode(client, invite.sender_id, {
      mode: "auto",
      inviteToken: null,
    });

    logPlaytestInfo("matchmaking.invite.declined", {
      playerId: params.actorId,
      metadata: { inviteId: invite.id },
    });

    return { status: "declined" };
  }

  const matchId = await bootstrapMatchRecord(client, {
    boardSeed: randomUUID(),
    playerAId: invite.sender_id,
    playerBId: invite.recipient_id,
  });

  await client
    .from("match_invitations")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
      match_id: matchId,
    })
    .eq("id", params.inviteId);

  await Promise.all([
    setPlayerStatus(client, invite.sender_id, "in_match"),
    setPlayerStatus(client, invite.recipient_id, "in_match"),
    updatePresenceMode(client, invite.sender_id, {
      mode: "auto",
      inviteToken: null,
    }),
    updatePresenceMode(client, invite.recipient_id, {
      mode: "auto",
      inviteToken: null,
    }),
  ]);

  trackInviteAccepted({
    matchId,
    playerId: params.actorId,
    inviteId: invite.id,
    opponentId: invite.sender_id,
  });

  return { status: "accepted", matchId };
}

export async function listPendingInvites(
  client: AnyClient,
  playerId: string,
  ttlSeconds = DEFAULT_INVITE_TTL_SECONDS
): Promise<PendingInviteSummary[]> {
  const { data, error } = await client
    .from("match_invitations")
    .select(
      `
        id,
        created_at,
        sender:sender_id (
          id,
          username,
          display_name
        )
      `
    )
    .eq("recipient_id", playerId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load invites: ${error.message}`);
  }

  return (data ?? [])
    .filter((row: any) => Boolean(row.sender))
    .map((row: any) => ({
      id: row.id as string,
      sender: {
        id: row.sender.id as string,
        username: row.sender.username as string,
        displayName: row.sender.display_name as string,
      },
      expiresAt: calculateInviteExpiry(
        new Date(row.created_at as string),
        ttlSeconds
      ),
    }));
}

export async function startAutoQueue(
  client: AnyClient,
  params: StartQueueParams
): Promise<QueueResult> {
  // 1. Check if already in a match
  const activeMatch = await findActiveMatchForPlayer(client, params.playerId);
  if (activeMatch) {
    // Ensure player status is consistent
    await setPlayerStatus(client, params.playerId, "in_match");
    await updatePresenceMode(client, params.playerId, {
      mode: "auto",
      inviteToken: null,
    });

    return {
      status: "matched",
      matchId: activeMatch.id,
    };
  }

  // 2. Mark as matchmaking
  await setPlayerStatus(client, params.playerId, "matchmaking");
  await updatePresenceMode(client, params.playerId, {
    mode: "auto",
    inviteToken: null,
  });

  const candidates = await fetchQueueCandidates(client, params.playerId);
  const opponent = selectQueueOpponent(
    candidates.map((candidate) => ({
      id: candidate.id,
      lastSeenAt: candidate.last_seen_at,
      username: candidate.username,
    })),
    params.playerId
  );

  if (!opponent) {
    return {
      status: "queued",
      estimatedWaitSeconds: DEFAULT_QUEUE_WAIT_SECONDS,
    };
  }

  // Atomically claim the opponent by updating their status with a condition
  // This prevents race conditions when two players try to match simultaneously
  const { count } = await client
    .from("players")
    .update({ status: "in_match" })
    .eq("id", opponent.id)
    .eq("status", "matchmaking"); // Only update if still in matchmaking

  // If we couldn't claim the opponent (someone else got them first), stay in queue
  if (!count || count === 0) {
    return {
      status: "queued",
      estimatedWaitSeconds: DEFAULT_QUEUE_WAIT_SECONDS,
    };
  }

  // Successfully claimed opponent, now create the match
  const matchId = await bootstrapMatchRecord(client, {
    boardSeed: randomUUID(),
    playerAId: params.playerId,
    playerBId: opponent.id,
  });

  // Update our own status and presence
  await Promise.all([
    setPlayerStatus(client, params.playerId, "in_match"),
    updatePresenceMode(client, params.playerId, {
      mode: "auto",
      inviteToken: null,
    }),
    updatePresenceMode(client, opponent.id, {
      mode: "auto",
      inviteToken: null,
    }),
  ]);

  logPlaytestInfo("matchmaking.queue.matched", {
    matchId,
    playerId: params.playerId,
    metadata: { opponentId: opponent.id },
  });

  return {
    status: "matched",
    matchId,
  };
}

export async function expireStaleInvites(
  client: AnyClient,
  {
    ttlSeconds = DEFAULT_INVITE_TTL_SECONDS,
    now = new Date(),
  }: { ttlSeconds?: number; now?: Date } = {}
): Promise<string[]> {
  const cutoff = new Date(now.getTime() - ttlSeconds * 1_000).toISOString();
  const { data, error } = await client
    .from("match_invitations")
    .update({
      status: "expired",
      responded_at: now.toISOString(),
    })
    .eq("status", "pending")
    .lte("created_at", cutoff)
    .select("id,sender_id");

  if (error) {
    throw new Error(`Failed to expire invites: ${error.message}`);
  }

  const expiredIds = data?.map((row) => row.id as string) ?? [];
  const senderIds = [...new Set(data?.map((row) => row.sender_id as string) ?? [])];

  if (senderIds.length > 0) {
    await client
      .from("players")
      .update({ status: "available" })
      .in("id", senderIds);

    await client
      .from("lobby_presence")
      .update({ invite_token: null, mode: "auto" })
      .in("player_id", senderIds);
  }

  if (expiredIds.length > 0) {
    logPlaytestInfo("matchmaking.invite.expired", {
      metadata: { count: expiredIds.length },
    });
  }

  return expiredIds;
}

async function fetchPlayer(client: AnyClient, playerId: string) {
  const { data, error } = await client
    .from("players")
    .select("id,status,username,display_name,last_seen_at")
    .eq("id", playerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | {
        id: string;
        status: LobbyStatus;
        username: string;
        display_name: string;
        last_seen_at: string;
      }
    | null;
}

async function fetchInvite(client: AnyClient, inviteId: string) {
  const { data, error } = await client
    .from("match_invitations")
    .select("id,sender_id,recipient_id,status,created_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as InviteRow | null;
}

async function fetchQueueCandidates(client: AnyClient, excludePlayerId: string) {
  const { data, error } = await client
    .from("players")
    .select("id,username,last_seen_at")
    .eq("status", "matchmaking")
    .neq("id", excludePlayerId)
    .order("last_seen_at", { ascending: true })
    .limit(5);

  if (error) {
    logPlaytestError("matchmaking.queue.fetch_failed", { error });
    return [];
  }

  return (data ?? []) as QueueCandidate[];
}

async function setPlayerStatus(
  client: AnyClient,
  playerId: string,
  status: LobbyStatus
) {
  const { error } = await client
    .from("players")
    .update({
      status,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", playerId);

  if (error) {
    logPlaytestError("matchmaking.player_status_failed", {
      playerId,
      metadata: { status },
      error,
    });
  }
}

async function updatePresenceMode(
  client: AnyClient,
  playerId: string,
  payload: { mode: "auto" | "direct_invite"; inviteToken: string | null }
) {
  const { error } = await client
    .from("lobby_presence")
    .update({
      mode: payload.mode,
      invite_token: payload.inviteToken,
      updated_at: new Date().toISOString(),
    })
    .eq("player_id", playerId);

  if (error) {
    logPlaytestError("matchmaking.presence_update_failed", {
      playerId,
      metadata: payload,
      error,
    });
  }
}


