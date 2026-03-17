"use server";

import "server-only";

import { z } from "zod";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { PlayerProfile, PlayerIdentity } from "@/lib/types/match";

const inputSchema = z.object({
  playerId: z.string().uuid(),
});

export interface GetPlayerProfileResult {
  status: "ok" | "not_found" | "error";
  profile?: PlayerProfile;
  error?: string;
}

export async function getPlayerProfile(
  playerId: string,
): Promise<GetPlayerProfileResult> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "error", error: "Authentication required." };
  }

  const parsed = inputSchema.safeParse({ playerId });
  if (!parsed.success) {
    return { status: "error", error: "Invalid player ID." };
  }

  const supabase = getServiceRoleClient();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(
      "id, username, display_name, avatar_url, status, last_seen_at, elo_rating, games_played, wins, losses, draws",
    )
    .eq("id", parsed.data.playerId)
    .single();

  if (playerError || !player) {
    return { status: "not_found" };
  }

  const { data: trendRows } = await supabase
    .from("match_ratings")
    .select("rating_after")
    .eq("player_id", parsed.data.playerId)
    .order("created_at", { ascending: false })
    .limit(5);

  const ratingTrend = (trendRows ?? [])
    .map((row) => row.rating_after as number)
    .reverse();

  const wins = player.wins as number;
  const losses = player.losses as number;
  const decisiveGames = wins + losses;

  const identity: PlayerIdentity = {
    id: player.id as string,
    username: player.username as string,
    displayName: player.display_name as string,
    avatarUrl: player.avatar_url as string | null,
    status: player.status as PlayerIdentity["status"],
    lastSeenAt: player.last_seen_at as string,
    eloRating: player.elo_rating as number,
  };

  return {
    status: "ok",
    profile: {
      identity,
      stats: {
        eloRating: player.elo_rating as number,
        gamesPlayed: player.games_played as number,
        wins,
        losses,
        draws: player.draws as number,
        winRate:
          decisiveGames > 0
            ? Math.round((wins / decisiveGames) * 100) / 100
            : null,
      },
      ratingTrend,
    },
  };
}
