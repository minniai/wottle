import "server-only";

import { lobbyNumbers, playerPresence } from "@/lib/presence/presenceService";
import { readEloRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LobbyCounts, LobbyLanguage, Overview } from "@/lib/types/standing";

/**
 * The lobby overview (spec 070 US10, S10; research R9): counts for this lobby
 * and the other, the door's here-now names, and, for a session, the viewer's
 * last match and last ten. A signed-out read never carries a player id or any
 * one player's matches (FR-040).
 */
const DOOR_ROWS = 8;
const NEWCOMER_RATING = 1200;
const OTHER: Record<LobbyLanguage, LobbyLanguage> = { is: "en", en: "is" };

export async function lobbyCounts(language: LobbyLanguage): Promise<LobbyCounts> {
  const [mine, other] = await Promise.all([lobbyNumbers(language), lobbyNumbers(OTHER[language])]);
  return { ...mine, other: { language: OTHER[language], here: other.here } };
}

type DoorRow = NonNullable<Overview["here"]>[number];

/** At most eight names: here before searching, then nearest the rating a new player starts at (Q2). */
export async function doorHere(language: LobbyLanguage): Promise<{ here: DoorRow[]; more: number }> {
  const present = (await playerPresence(language)).filter((p) => p.state === "here" || p.state === "searching");
  if (present.length === 0) return { here: [], more: 0 };
  const ids = present.map((p) => p.playerId);
  const client = getServiceRoleClient();
  const [ratings, names] = await Promise.all([
    readEloRatings(client, ids, language),
    client.from("players").select("id, display_name").in("id", ids),
  ]);
  const nameOf = new Map((names.data ?? []).map((r) => [r.id as string, r.display_name as string]));
  const rows = present
    .map((p) => ({ displayName: nameOf.get(p.playerId) ?? "", rating: ratings.get(p.playerId) ?? NEWCOMER_RATING, state: p.state as DoorRow["state"] }))
    .filter((r) => r.displayName)
    .sort((a, b) => (a.state === b.state ? Math.abs(a.rating - NEWCOMER_RATING) - Math.abs(b.rating - NEWCOMER_RATING) : a.state === "here" ? -1 : 1));
  return { here: rows.slice(0, DOOR_ROWS), more: Math.max(0, rows.length - DOOR_ROWS) };
}

export async function publicOverview(language: LobbyLanguage): Promise<Overview> {
  const [counts, door] = await Promise.all([lobbyCounts(language), doorHere(language)]);
  return { counts, here: door.here, more: door.more };
}

/** With a session: the counts only for now; the last match and last ten arrive with US10. */
export async function viewerOverview(_playerId: string, language: LobbyLanguage): Promise<Overview> {
  return { counts: await lobbyCounts(language) };
}
