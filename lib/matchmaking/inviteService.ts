import type { Language } from "@/lib/types/game-config";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LobbyStatus, PlayerIdentity } from "@/lib/types/match";
import { findActiveMatchForPlayer } from "./service";
import { acceptInvite, inviteTtlSeconds, pairFromQueue } from "@/lib/match/createMatch";
import { logPlaytestError, logPlaytestInfo, trackInviteAccepted } from "@/lib/observability/log";
import { QUEUE_FRESH_MS } from "@/lib/constants/table";
import { recordAttention, type Attention } from "./attention";
import { readCooldownUntil } from "./tableStatus";

type AnyClient = SupabaseClient<any, any, any>;

const DEFAULT_INVITE_TTL_SECONDS = inviteTtlSeconds();
const DEFAULT_QUEUE_WAIT_SECONDS = Number(
  process.env.PLAYTEST_QUEUE_WAIT_SECONDS ?? "15"
);

export interface SendDirectInviteParams {
  senderId: string;
  recipientId: string;
  ttlSeconds?: number;
  /** Spec 060: the lobby the challenge is sent from; Icelandic unless given. */
  language?: Language;
}

/** Sent, or — when the recipient had already challenged the sender — accepted at once (spec 067). */
export type SendDirectInviteResult =
  | { status: "sent"; inviteId: string; expiresAt: string }
  | { status: "accepted"; matchId: string }
  /** Spec 069 FR-024: two table leaves in 10 minutes; sending waits until then. */
  | { status: "cooldown"; until: string };

export interface RespondInviteParams {
  inviteId: string;
  actorId: string;
  decision: "accepted" | "declined";
}

export type RespondInviteResult =
  | { status: "accepted"; matchId: string }
  | { status: "declined" }
  /** The other player is in a match now; `name` is the one who cannot play (spec 067 FR-019). */
  | { status: "busy"; name: string };

export interface PendingInviteSummary {
  id: string;
  sender: Pick<PlayerIdentity, "id" | "username" | "displayName">;
  expiresAt: string;
}

/** What became of the challenger's latest challenge (the lobby's waiting line reads it). */
export interface OutgoingInviteSummary {
  id: string;
  status: InviteRow["status"];
  recipientName: string;
  /** Declined while the recipient is in a match: they took another challenge. */
  recipientInMatch: boolean;
}

export interface StartQueueParams {
  playerId: string;
  /** Spec 060: the lobby's game language; players are paired only within it. Icelandic unless given. */
  language?: Language;
  /** Spec 069: the searching tab's visibility and last input; a hidden tab pauses the search. */
  attention?: Attention;
}

export interface QueueResult {
  /** `paused`: the tab is hidden (spec 069 FR-021); `cooldown`: two table leaves in 10 minutes (FR-024). */
  status: "queued" | "matched" | "paused" | "cooldown";
  matchId?: string;
  estimatedWaitSeconds?: number;
  /** When the search began; polls never move it (FR-020). */
  queuedAt?: string;
  /** The cooldown's end. */
  until?: string;
}

interface InviteRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "withdrawn" | "superseded";
  created_at: string;
  responded_at: string | null;
  match_id: string | null;
  language?: Language | null;
}

interface QueueCandidate {
  id: string;
  username: string;
  queued_at: string | null;
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

/**
 * The searcher who joined first (spec 069 FR-020). Two searchers claiming at
 * once cannot book anyone twice: `pair_from_queue` locks both players and
 * refuses one no longer searching (spec 067), so no tie-break is needed.
 */
export function selectQueueOpponent<T extends { id: string; queuedAt: string | null }>(
  candidates: T[],
  selfId: string
): T | null {
  const joined = (c: T) => (c.queuedAt ? Date.parse(c.queuedAt) : Number.POSITIVE_INFINITY);
  const filtered = candidates.filter((candidate) => candidate.id !== selfId);
  return filtered.length === 0 ? null : filtered.sort((a, b) => joined(a) - joined(b))[0];
}

export async function sendDirectInvite(
  client: AnyClient,
  params: SendDirectInviteParams
): Promise<SendDirectInviteResult> {
  if (params.senderId === params.recipientId) {
    throw new Error("You cannot invite yourself.");
  }
  const until = await readCooldownUntil(client, params.senderId);
  if (until) return { status: "cooldown", until };

  const ttlSeconds = params.ttlSeconds ?? DEFAULT_INVITE_TTL_SECONDS;
  const expiresAt = calculateInviteExpiry(new Date(), ttlSeconds);

  const recipient = await fetchPlayer(client, params.recipientId);
  if (!recipient) {
    throw new Error("Recipient not found.");
  }
  if (recipient.status !== "available") {
    throw new Error("Recipient is unavailable right now.");
  }
  const language = params.language ?? "is";
  if ((await presenceLanguage(client, params.recipientId)) !== language) {
    throw new Error("Recipient is in another language's lobby.");
  }

  const crossed = await pendingInviteBetween(client, params.recipientId, params.senderId);
  if (crossed) return acceptCrossedChallenge(client, crossed, params.senderId);

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
      language,
    })
    .select("id,created_at")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Unable to create invitation at this time."
    );
  }

  await updatePresenceMode(client, params.senderId, {
    mode: "direct_invite",
    inviteToken: data.id,
  });

  logPlaytestInfo("matchmaking.invite.sent", {
    playerId: params.senderId,
    metadata: { recipientId: params.recipientId },
  });

  return { status: "sent", inviteId: data.id, expiresAt };
}

async function pendingInviteBetween(client: AnyClient, senderId: string, recipientId: string): Promise<string | null> {
  const { data } = await client
    .from("match_invitations")
    .select("id")
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .eq("status", "pending")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Both challenged each other: the second challenge is the answer to the first. */
async function acceptCrossedChallenge(client: AnyClient, inviteId: string, actorId: string): Promise<SendDirectInviteResult> {
  const result = await acceptInvite(client, { inviteId, actorId, origin: "crossed_challenge" });
  if (result.status === "created") return { status: "accepted", matchId: result.matchId };
  throw new Error(result.status === "busy" ? "Recipient is unavailable right now." : "Invite is no longer active.");
}

export async function respondToInvite(
  client: AnyClient,
  params: RespondInviteParams
): Promise<RespondInviteResult> {
  const invite = await fetchInvite(client, params.inviteId);
  if (!invite) {
    throw new Error("Invite not found.");
  }
  if (invite.recipient_id !== params.actorId) {
    throw new Error("You cannot respond to this invite.");
  }
  if (params.decision === "accepted") {
    return acceptChallenge(client, invite, params.actorId);
  }
  if (invite.status !== "pending") {
    throw new Error("Invite is no longer active.");
  }

  await client
    .from("match_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", params.inviteId);
  await updatePresenceMode(client, invite.sender_id, { mode: "auto", inviteToken: null });
  logPlaytestInfo("matchmaking.invite.declined", {
    playerId: params.actorId,
    metadata: { inviteId: invite.id },
  });
  return { status: "declined" };
}

async function acceptChallenge(client: AnyClient, invite: InviteRow, actorId: string): Promise<RespondInviteResult> {
  const result = await acceptInvite(client, { inviteId: invite.id, actorId });
  if (result.status === "busy") return { status: "busy", name: await displayNameOf(client, result.playerId) };
  if (result.status === "not_recipient") throw new Error("You cannot respond to this invite.");
  if (result.status !== "created") throw new Error("Invite is no longer active.");
  trackInviteAccepted({ matchId: result.matchId, playerId: actorId, inviteId: invite.id, opponentId: invite.sender_id });
  return { status: "accepted", matchId: result.matchId };
}

async function displayNameOf(client: AnyClient, playerId: string): Promise<string> {
  const player = await fetchPlayer(client, playerId);
  return player?.display_name ?? player?.username ?? "";
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

export async function getOutgoingInvite(
  client: AnyClient,
  senderId: string
): Promise<OutgoingInviteSummary | null> {
  const { data, error } = await client
    .from("match_invitations")
    .select("id,status,recipient:recipient_id(username,display_name,status)")
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load the sent invite: ${error.message}`);
  }
  if (!data) return null;
  const row = data as any;
  return {
    id: row.id as string,
    status: row.status as InviteRow["status"],
    recipientName: (row.recipient?.display_name ?? row.recipient?.username ?? "") as string,
    recipientInMatch: row.recipient?.status === "in_match",
  };
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

  // 2. Check if locked by opponent (prevent overwrite race condition)
  const { data: player } = await client
    .from("players")
    .select("status, queued_at, last_seen_at")
    .eq("id", params.playerId)
    .single();

  if (player?.status === "in_match") {
    return {
      status: "queued",
      estimatedWaitSeconds: 1,
    };
  }

  // Spec 069: the tab's attention, the cooldown, and a hidden tab's pause come before joining.
  if (params.attention) await recordAttention(client, params.playerId, params.attention);
  const until = await readCooldownUntil(client, params.playerId);
  if (until) {
    logPlaytestInfo("table.cooldown", { playerId: params.playerId, metadata: { until } });
    return { status: "cooldown", until };
  }
  const language = params.language ?? "is";
  if (params.attention && !params.attention.visible) return pauseSearch(client, params.playerId, language);

  // 3. Join the queue for this language (spec 060 FR-018), keeping the join time of a search still running.
  const queuedAt = await joinQueue(client, params.playerId, language, player as JoinFacts | null);
  await updatePresenceMode(client, params.playerId, {
    mode: "auto",
    inviteToken: null,
  });

  const candidates = await fetchQueueCandidates(client, params.playerId, language);
  const opponent = selectQueueOpponent(
    candidates.map((candidate) => ({ id: candidate.id, queuedAt: candidate.queued_at, username: candidate.username })),
    params.playerId
  );

  if (!opponent) {
    return { status: "queued", estimatedWaitSeconds: DEFAULT_QUEUE_WAIT_SECONDS, queuedAt };
  }

  // The pairing, the status and presence writes and the end of every other
  // commitment either player had happen in one transaction (spec 067).
  const result = await pairFromQueue(client, { selfId: params.playerId, opponentId: opponent.id, language });
  if (result.status !== "created") {
    return { status: "queued", estimatedWaitSeconds: DEFAULT_QUEUE_WAIT_SECONDS, queuedAt };
  }

  logPlaytestInfo("matchmaking.queue.matched", {
    matchId: result.matchId,
    playerId: params.playerId,
    metadata: { opponentId: opponent.id },
  });
  return { status: "matched", matchId: result.matchId };
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
    .select("id");

  if (error) {
    throw new Error(`Failed to expire invites: ${error.message}`);
  }

  const expiredIds = data?.map((row) => row.id as string) ?? [];

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

/** The lobby a player is present in; a player with no presence row counts as Icelandic (the default lobby). */
async function presenceLanguage(client: AnyClient, playerId: string): Promise<Language> {
  const { data } = await client.from("lobby_presence").select("language").eq("player_id", playerId).maybeSingle();
  return ((data as { language?: Language } | null)?.language ?? "is") as Language;
}

async function fetchInvite(client: AnyClient, inviteId: string) {
  const { data, error } = await client
    .from("match_invitations")
    .select("id,sender_id,recipient_id,status,created_at,language")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as InviteRow | null;
}

/** Searchers heard from within 10s and not paused, in the order they joined (spec 069 FR-020, FR-021). */
async function fetchQueueCandidates(client: AnyClient, excludePlayerId: string, language: Language) {
  const { data, error } = await client
    .from("players")
    .select("id,username,queued_at")
    .eq("status", "matchmaking")
    .eq("queue_language", language)
    .eq("search_paused", false)
    .gt("last_seen_at", new Date(Date.now() - QUEUE_FRESH_MS).toISOString())
    .neq("id", excludePlayerId)
    .order("queued_at", { ascending: true })
    .limit(5);

  if (error) {
    logPlaytestError("matchmaking.queue.fetch_failed", { error });
    return [];
  }

  return (data ?? []) as QueueCandidate[];
}

interface JoinFacts {
  status: string;
  queued_at: string | null;
  last_seen_at: string | null;
}

/** A search heard from this recently is still running: its join time is kept (a poll, a requeue). */
const SEARCH_CONTINUES_MS = 30_000;

function joinTimeFor(facts: JoinFacts | null, now: Date): string {
  const running = facts?.status === "matchmaking" && facts.queued_at && facts.last_seen_at && now.getTime() - Date.parse(facts.last_seen_at) < SEARCH_CONTINUES_MS;
  return running ? facts!.queued_at! : now.toISOString();
}

async function joinQueue(client: AnyClient, playerId: string, language: Language, facts: JoinFacts | null): Promise<string> {
  const now = new Date();
  const queuedAt = joinTimeFor(facts, now);
  const { error } = await client
    .from("players")
    .update({ status: "matchmaking", queue_language: language, last_seen_at: now.toISOString(), queued_at: queuedAt, search_paused: false })
    .eq("id", playerId);
  if (error) logPlaytestError("matchmaking.player_status_failed", { playerId, metadata: { status: "matchmaking", language }, error });
  return queuedAt;
}

/** A hidden tab pauses its search on every device (spec 069 FR-021): the queue skips it; its place is kept. */
async function pauseSearch(client: AnyClient, playerId: string, language: Language): Promise<QueueResult> {
  const { error } = await client.from("players").update({ status: "matchmaking", queue_language: language, search_paused: true }).eq("id", playerId);
  if (error) logPlaytestError("matchmaking.player_status_failed", { playerId, metadata: { status: "paused", language }, error });
  logPlaytestInfo("queue.paused", { playerId });
  return { status: "paused" };
}

async function setPlayerStatus(
  client: AnyClient,
  playerId: string,
  status: LobbyStatus
) {
  // Only the queue sets a queue language; any other status leaves the queue.
  const { error } = await client
    .from("players")
    .update({
      status,
      queue_language: null,
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


