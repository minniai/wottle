"use server";

import "server-only";

import { z } from "zod";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MatchRatingResult } from "@/lib/types/match";

const inputSchema = z.object({
  matchId: z.string().uuid(),
});

export interface GetMatchRatingsResult {
  status: "ok" | "not_found" | "error";
  ratings?: MatchRatingResult[];
  error?: string;
}

export async function getMatchRatings(
  matchId: string,
): Promise<GetMatchRatingsResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "error", error: "Authentication required." };
  }

  const parsed = inputSchema.safeParse({ matchId });
  if (!parsed.success) {
    return { status: "error", error: "Invalid match ID." };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("match_ratings")
    .select(
      "player_id, rating_before, rating_after, rating_delta, k_factor, match_result",
    )
    .eq("match_id", parsed.data.matchId);

  if (error) {
    return { status: "error", error: error.message };
  }

  if (!data || data.length === 0) {
    return { status: "not_found" };
  }

  const ratings: MatchRatingResult[] = data.map((row) => ({
    playerId: row.player_id,
    ratingBefore: row.rating_before,
    ratingAfter: row.rating_after,
    ratingDelta: row.rating_delta,
    kFactor: row.k_factor,
    matchResult: row.match_result as "win" | "loss" | "draw",
  }));

  return { status: "ok", ratings };
}
