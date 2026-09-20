import type { SupabaseClient } from "@supabase/supabase-js";

import { trackStaleMatchWrite } from "@/lib/observability/log";

type AnyClient = SupabaseClient<any, any, any>;

export interface RoundEndWrite {
  matchId: string;
  /** The round the writer read when it started: the row must still be on it. */
  expectedRound: number;
  payload: Record<string, unknown>;
}

export type RoundEndWriteResult = "written" | "stale";

/**
 * The round-end write to the match row, as a compare-and-set on the round the
 * writer read and on the match not being completed (spec 049
 * contracts/round-end-write.md). On 2026-09-20 a thawed `after()` hook wrote
 * round 5's end onto a match completed two minutes earlier. Zero rows is not
 * an error: it is logged at warn with what would have been written.
 */
export async function writeRoundEnd(
  supabase: AnyClient,
  write: RoundEndWrite,
): Promise<RoundEndWriteResult> {
  const { data, error } = await supabase
    .from("matches")
    .update(write.payload)
    .eq("id", write.matchId)
    .eq("current_round", write.expectedRound)
    .neq("state", "completed")
    .select("id");

  if (error) throw new Error(`Failed to update match ${write.matchId}: ${error.message}`);
  if (data && data.length > 0) return "written";

  trackStaleMatchWrite({
    matchId: write.matchId,
    expectedRound: write.expectedRound,
    carried: write.payload,
  });
  return "stale";
}
