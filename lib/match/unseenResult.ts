import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * A match that ended while a player was away from it stays in their line slot
 * until they open the result (spec 070 US8). The only caller of
 * `mark_unseen_result` and `clear_unseen_result`.
 */
export async function markUnseenResult(matchId: string): Promise<void> {
  // Best effort after the result is written: a failure here never fails the completion.
  try {
    const { error } = await getServiceRoleClient().rpc("mark_unseen_result", { p_match: matchId });
    if (error) console.warn(JSON.stringify({ event: "match.unseen_result.failed", matchId, error: error.message }));
  } catch (error) {
    console.warn(JSON.stringify({ event: "match.unseen_result.failed", matchId, error: error instanceof Error ? error.message : String(error) }));
  }
}

/** Opening the result, or signing out, clears it. With no match id, whatever is held. */
export async function clearUnseenResult(playerId: string, matchId: string | null): Promise<void> {
  const { error } = await getServiceRoleClient().rpc("clear_unseen_result", { p_player: playerId, p_match: matchId });
  if (error) console.warn(JSON.stringify({ event: "match.unseen_result.clear_failed", playerId, error: error.message }));
}
