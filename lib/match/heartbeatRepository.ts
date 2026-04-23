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
export async function findStaleParticipant(
  client: AnyClient,
  opts: FindStaleParticipantOptions,
): Promise<string | null> {
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
      return playerId;
    }
  }
  return null;
}
