"use server";

import "server-only";
import { z } from "zod";

import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { PlayerIdentity } from "@/lib/types/match";

const inputSchema = z.object({
  matchId: z.string().uuid(),
});

export type MatchOverviewState =
  | { status: "ok"; self: PlayerIdentity; opponent: PlayerIdentity }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

export async function getMatchOverviewAction(
  input: z.infer<typeof inputSchema>,
): Promise<MatchOverviewState> {
  const session = await readLobbySession();
  if (!session) {
    return { status: "unauthenticated" };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid matchId." };
  }

  try {
    const supabase = getServiceRoleClient();
    const { data: match } = await supabase
      .from("matches")
      .select("player_a_id, player_b_id")
      .eq("id", parsed.data.matchId)
      .maybeSingle();

    if (!match) {
      return { status: "not_found" };
    }

    const selfId = session.player.id;
    if (match.player_a_id !== selfId && match.player_b_id !== selfId) {
      return { status: "forbidden" };
    }

    const opponentId =
      match.player_a_id === selfId ? match.player_b_id : match.player_a_id;

    const { data: players } = await supabase
      .from("players")
      .select(
        "id, username, display_name, avatar_url, status, last_seen_at, elo_rating",
      )
      .in("id", [selfId, opponentId]);

    if (!players || players.length !== 2) {
      return { status: "error", message: "Player records missing." };
    }

    const toIdentity = (row: (typeof players)[number]): PlayerIdentity => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      status: row.status,
      lastSeenAt: row.last_seen_at,
      eloRating: row.elo_rating,
    });

    const self = toIdentity(players.find((p) => p.id === selfId)!);
    const opponent = toIdentity(players.find((p) => p.id === opponentId)!);

    return { status: "ok", self, opponent };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Lookup failed.",
    };
  }
}
