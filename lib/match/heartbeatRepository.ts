import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, any, any>;

/**
 * A player is considered disconnected when their last heartbeat is older
 * than this threshold. The surviving client polls /state every ~2s, so the
 * upper bound on modal latency is roughly HEARTBEAT_STALE_MS + 2s.
 *
 * The acceptance criterion in issue #164 is ≤15s, so 10s gives a healthy
 * margin while avoiding false positives on transient network blips that
 * recover within 5 missed polls.
 */
export const HEARTBEAT_STALE_MS = 10_000;

/**
 * Matches created in the last HEARTBEAT_STALE_MS are skipped entirely —
 * both players' first poll may not have landed yet, and a missing
 * heartbeat row is not a signal during that grace window.
 */
const GRACE_WINDOW_MS = HEARTBEAT_STALE_MS;

export interface FindStaleParticipantOptions {
  matchId: string;
  playerAId: string;
  playerBId: string;
  matchCreatedAt: Date;
  now?: Date;
}

/**
 * Upsert the caller's heartbeat on every state poll. Keyed by
 * (match_id, player_id) so concurrent polls from the same player
 * collapse into a single row update.
 */
export async function recordHeartbeat(
  client: AnyClient,
  matchId: string,
  playerId: string,
): Promise<void> {
  const { error } = await client
    .from("match_heartbeats")
    .upsert(
      {
        match_id: matchId,
        player_id: playerId,
        last_seen_at: new Date().toISOString(),
        // Spec 070: this beat is from the match page itself.
        source: "match",
        cadence_ms: 2_000,
      },
      { onConflict: "match_id,player_id" },
    );
  if (error) {
    // Non-fatal — heartbeats are a safety net, not a hard requirement for
    // state delivery. Log and continue so the poll still returns the match
    // snapshot to the caller.
    console.warn("[heartbeat] recordHeartbeat failed:", error.message);
  }
}

/**
 * Returns the player id whose heartbeat has gone stale, or null when both
 * participants are fresh (or the match is still inside the grace window).
 *
 * Called from `loadMatchState` on every poll — this is the fallback that
 * detects network drops where neither `pagehide` → `sendBeacon` nor
 * Realtime presence leave fired (issue #164).
 */
export interface StaleParticipant {
  playerId: string;
  /** ISO timestamp from which the reconnection window counts: last heartbeat + HEARTBEAT_STALE_MS. */
  disconnectedAt: string;
}

/**
 * Like {@link findStaleParticipant} but also returns when the participant is
 * considered to have gone away, so the client can count the window down from
 * the same anchor on every device (spec 044, R13).
 */
export async function findStaleParticipantDetail(
  client: AnyClient,
  opts: FindStaleParticipantOptions,
): Promise<StaleParticipant | null> {
  const now = opts.now ?? new Date();

  if (now.getTime() - opts.matchCreatedAt.getTime() < GRACE_WINDOW_MS) {
    return null;
  }

  const { data, error } = await client
    .from("match_heartbeats")
    .select("player_id, last_seen_at")
    .eq("match_id", opts.matchId);

  if (error || !data) {
    return null;
  }

  const lastSeenByPlayer = new Map<string, number>();
  for (const row of data as Array<{ player_id: string; last_seen_at: string }>) {
    lastSeenByPlayer.set(row.player_id, new Date(row.last_seen_at).getTime());
  }

  const threshold = now.getTime() - HEARTBEAT_STALE_MS;

  for (const playerId of [opts.playerAId, opts.playerBId]) {
    const lastSeen = lastSeenByPlayer.get(playerId);
    if (lastSeen === undefined || lastSeen <= threshold) {
      const anchor = lastSeen === undefined ? opts.matchCreatedAt.getTime() + GRACE_WINDOW_MS : lastSeen + HEARTBEAT_STALE_MS;
      return { playerId, disconnectedAt: new Date(anchor).toISOString() };
    }
  }
  return null;
}

export async function findStaleParticipant(
  client: AnyClient,
  opts: FindStaleParticipantOptions,
): Promise<string | null> {
  const stale = await findStaleParticipantDetail(client, opts);
  return stale?.playerId ?? null;
}

/** A page's beat is fresh for three of its beats plus 5s (spec 070 FR-028), as presence reckons it. */
const PAGE_MISSED_BEATS = 3;
const PAGE_SLACK_MS = 5_000;

interface HeartbeatRow {
  player_id: string;
  last_seen_at: string;
  source: "match" | "page";
  cadence_ms: number;
}

export interface Participants {
  stale: StaleParticipant | null;
  /** A player whose app is open on another page (the lobby, a profile): `stepped out`, never reconnecting. */
  steppedOut: string | null;
}

/**
 * Who has gone quiet, and who has only stepped out (spec 070 US8, FR-031).
 * A beat from the match is fresh for 10s; a beat from a page for three of its
 * own beats plus 5s. A player fresh from a page is stepped out and not stale.
 */
export async function readParticipants(client: AnyClient, opts: FindStaleParticipantOptions): Promise<Participants> {
  const now = opts.now ?? new Date();
  if (now.getTime() - opts.matchCreatedAt.getTime() < GRACE_WINDOW_MS) return { stale: null, steppedOut: null };
  const { data, error } = await client.from("match_heartbeats").select("player_id, last_seen_at, source, cadence_ms").eq("match_id", opts.matchId);
  if (error || !data) return { stale: null, steppedOut: null };
  const rows = new Map((data as HeartbeatRow[]).map((r) => [r.player_id, r]));
  let steppedOut: string | null = null;
  for (const playerId of [opts.playerAId, opts.playerBId]) {
    const row = rows.get(playerId);
    const seen = row ? Date.parse(row.last_seen_at) : undefined;
    const pageFresh = row?.source === "page" && seen !== undefined && now.getTime() - seen < PAGE_MISSED_BEATS * row.cadence_ms + PAGE_SLACK_MS;
    if (pageFresh) {
      steppedOut = playerId;
      continue;
    }
    if (seen === undefined || seen <= now.getTime() - HEARTBEAT_STALE_MS) {
      const anchor = seen === undefined ? opts.matchCreatedAt.getTime() + GRACE_WINDOW_MS : seen + HEARTBEAT_STALE_MS;
      return { stale: { playerId, disconnectedAt: new Date(anchor).toISOString() }, steppedOut };
    }
  }
  return { stale: null, steppedOut };
}
