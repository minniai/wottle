import type { Language } from "@/lib/types/game-config";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LobbyStatus, PlayerIdentity } from "@/lib/types/match";
import { findActiveMatchForPlayer } from "./service";
import { pairFromQueue } from "@/lib/match/createMatch";
import { logPlaytestError, logPlaytestInfo, trackInviteAccepted } from "@/lib/observability/log";
import { QUEUE_FRESH_MS } from "@/lib/constants/table";
import { recordAttention, type Attention } from "./attention";
import { readCooldownUntil } from "./tableStatus";

type AnyClient = SupabaseClient<any, any, any>;

const DEFAULT_QUEUE_WAIT_SECONDS = Number(
  process.env.PLAYTEST_QUEUE_WAIT_SECONDS ?? "15"
);

export interface StartQueueParams {
  playerId: string;
  /** Spec 060: the lobby's game language; players are paired only within it. Icelandic unless given. */
  language?: Language;
  /** Spec 069: the searching tab's visibility and last input; a hidden tab pauses the search. */
  attention?: Attention;
  /**
   * Spec 069: the first poll of a search, or `resume ▸`: clears a pause. Any other
   * poll leaves it, so one already in flight when the tab went hidden cannot undo it.
   */
  resume?: boolean;
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

interface QueueCandidate {
  id: string;
  username: string;
  queued_at: string | null;
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

export async function startAutoQueue(
  client: AnyClient,
  params: StartQueueParams
): Promise<QueueResult> {
  // 1. Check if already in a match
  const activeMatch = await findActiveMatchForPlayer(client, params.playerId);
  if (activeMatch) {
    // Ensure player status is consistent
    await setPlayerStatus(client, params.playerId, "in_match");

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
  const queuedAt = await joinQueue(client, params.playerId, language, player as JoinFacts | null, Boolean(params.resume));

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

async function joinQueue(client: AnyClient, playerId: string, language: Language, facts: JoinFacts | null, resume: boolean): Promise<string> {
  const now = new Date();
  const queuedAt = joinTimeFor(facts, now);
  const fresh = queuedAt === now.toISOString();
  const { error } = await client
    .from("players")
    .update({ status: "matchmaking", queue_language: language, last_seen_at: now.toISOString(), queued_at: queuedAt, ...(fresh || resume ? { search_paused: false } : {}) })
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

