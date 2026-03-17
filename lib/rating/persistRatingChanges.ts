import { getServiceRoleClient } from "../supabase/server";
import type { MatchRatingResult } from "../types/match";

async function incrementPlayerStats(
  supabase: ReturnType<typeof getServiceRoleClient>,
  player: MatchRatingResult,
): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("players")
    .select("games_played, wins, losses, draws")
    .eq("id", player.playerId)
    .single();

  if (fetchError || !data) {
    throw new Error(
      `Failed to fetch player stats: ${fetchError?.message}`,
    );
  }

  const { error: updateError } = await supabase
    .from("players")
    .update({
      elo_rating: player.ratingAfter,
      games_played: data.games_played + 1,
      wins: data.wins + (player.matchResult === "win" ? 1 : 0),
      losses:
        data.losses + (player.matchResult === "loss" ? 1 : 0),
      draws:
        data.draws + (player.matchResult === "draw" ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", player.playerId);

  if (updateError) {
    throw new Error(
      `Failed to update player stats: ${updateError.message}`,
    );
  }
}

export async function persistRatingChanges(
  matchId: string,
  playerA: MatchRatingResult,
  playerB: MatchRatingResult,
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error: insertError } = await supabase
    .from("match_ratings")
    .insert([
      {
        match_id: matchId,
        player_id: playerA.playerId,
        rating_before: playerA.ratingBefore,
        rating_after: playerA.ratingAfter,
        rating_delta: playerA.ratingDelta,
        k_factor: playerA.kFactor,
        match_result: playerA.matchResult,
      },
      {
        match_id: matchId,
        player_id: playerB.playerId,
        rating_before: playerB.ratingBefore,
        rating_after: playerB.ratingAfter,
        rating_delta: playerB.ratingDelta,
        k_factor: playerB.kFactor,
        match_result: playerB.matchResult,
      },
    ]);

  if (insertError) {
    throw new Error(
      `Failed to insert match_ratings: ${insertError.message}`,
    );
  }

  await incrementPlayerStats(supabase, playerA);
  await incrementPlayerStats(supabase, playerB);

  console.log(
    JSON.stringify({
      event: "rating.updated",
      matchId,
      playerA: {
        id: playerA.playerId,
        before: playerA.ratingBefore,
        after: playerA.ratingAfter,
        delta: playerA.ratingDelta,
        k: playerA.kFactor,
        result: playerA.matchResult,
      },
      playerB: {
        id: playerB.playerId,
        before: playerB.ratingBefore,
        after: playerB.ratingAfter,
        delta: playerB.ratingDelta,
        k: playerB.kFactor,
        result: playerB.matchResult,
      },
    }),
  );
}
