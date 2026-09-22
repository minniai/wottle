import { getServiceRoleClient } from "../supabase/server";
import type { Language } from "../types/game-config";
import type { MatchRatingResult } from "../types/match";
import { writeRatingResult, type RatingRecord } from "./playerRatings";

/** A player's change and the record it was computed from. */
export type RatedPlayer = MatchRatingResult & { before: RatingRecord };

/**
 * Record a match's rating changes in its language (spec 060 US4): one
 * `match_ratings` row per player, and both players' `player_ratings` row for
 * that language. `before` is each player's record as the change was computed.
 */
export async function persistRatingChanges(
  matchId: string,
  { language, playerA, playerB }: { language: Language; playerA: RatedPlayer; playerB: RatedPlayer },
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
        language,
      },
      {
        match_id: matchId,
        player_id: playerB.playerId,
        rating_before: playerB.ratingBefore,
        rating_after: playerB.ratingAfter,
        rating_delta: playerB.ratingDelta,
        k_factor: playerB.kFactor,
        match_result: playerB.matchResult,
        language,
      },
    ]);

  if (insertError) {
    throw new Error(
      `Failed to insert match_ratings: ${insertError.message}`,
    );
  }

  for (const player of [playerA, playerB]) {
    await writeRatingResult(supabase, {
      playerId: player.playerId,
      language,
      before: player.before,
      ratingAfter: player.ratingAfter,
      result: player.matchResult,
    });
  }

  console.log(
    JSON.stringify({
      event: "rating.updated",
      matchId,
      language,
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
