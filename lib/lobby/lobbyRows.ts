import "server-only";

import { headToHead } from "@/lib/matchmaking/headToHead";
import { playerPresence } from "@/lib/presence/presenceService";
import { readEloRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LobbyLanguage, LobbyRow } from "@/lib/types/standing";

const NEWCOMER_RATING = 1200;

/**
 * Who is here in a lobby, for a signed-in viewer (spec 070 US2, research R2):
 * everyone with a fresh tab there except the viewer, with their rating in that
 * language and the viewer's record against them. Three reads, whatever the size.
 */
export async function lobbyRows(viewerId: string, language: LobbyLanguage): Promise<LobbyRow[]> {
  const present = (await playerPresence(language)).filter((p) => p.playerId !== viewerId);
  if (present.length === 0) return [];
  const ids = present.map((p) => p.playerId);
  const client = getServiceRoleClient();
  const [ratings, records, names] = await Promise.all([
    readEloRatings(client, ids, language),
    headToHead(viewerId, language),
    client.from("players").select("id, username, display_name").in("id", ids),
  ]);
  const who = new Map((names.data ?? []).map((r) => [r.id as string, { handle: r.username as string, name: r.display_name as string }]));
  return present.flatMap((p) => {
    const person = who.get(p.playerId);
    if (!person) return [];
    return [{
      playerId: p.playerId,
      displayName: person.name,
      handle: person.handle,
      rating: ratings.get(p.playerId) ?? NEWCOMER_RATING,
      state: p.state,
      movesPlayed: p.movesPlayed,
      record: records.get(p.playerId) ?? null,
    }];
  });
}
