import type { Language } from "@/lib/types/game-config";

/** A player's rating and record in one language (spec 060 US4). */
export interface RatingRecord {
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Someone who has not played a language yet: the starting rating, no games. */
export const DEFAULT_RATING_RECORD: RatingRecord = { eloRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };

interface RatingRow {
  player_id: string;
  elo_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
}

// Loosely typed: every Supabase client (service role, test harness) fits.
type AnyClient = { from: (table: string) => any };

function toRecord(row: RatingRow): RatingRecord {
  return { eloRating: row.elo_rating, gamesPlayed: row.games_played, wins: row.wins, losses: row.losses, draws: row.draws };
}

/** Each player's record in `language`; a player with no row reads as `DEFAULT_RATING_RECORD`. */
export async function readRatings(client: AnyClient, playerIds: string[], language: Language): Promise<Map<string, RatingRecord>> {
  const result = new Map<string, RatingRecord>(playerIds.map((id) => [id, { ...DEFAULT_RATING_RECORD }]));
  if (playerIds.length === 0) return result;
  const { data, error } = await client
    .from("player_ratings")
    .select("player_id, elo_rating, games_played, wins, losses, draws")
    .eq("language", language)
    .in("player_id", playerIds);
  if (error) throw new Error(`Failed to read ratings: ${error.message}`);
  for (const row of (data ?? []) as RatingRow[]) result.set(row.player_id, toRecord(row));
  return result;
}

/** Each player's rating in `language`, for lists that show one number beside a name. */
export async function readEloRatings(client: AnyClient, playerIds: string[], language: Language): Promise<Map<string, number>> {
  const records = await readRatings(client, playerIds, language);
  return new Map([...records].map(([id, record]) => [id, record.eloRating]));
}

/** Write a player's new rating and add one result to their record in `language`. */
export async function writeRatingResult(
  client: AnyClient,
  input: { playerId: string; language: Language; before: RatingRecord; ratingAfter: number; result: "win" | "loss" | "draw" },
): Promise<void> {
  const { before } = input;
  const { error } = await client.from("player_ratings").upsert(
    {
      player_id: input.playerId,
      language: input.language,
      elo_rating: input.ratingAfter,
      games_played: before.gamesPlayed + 1,
      wins: before.wins + (input.result === "win" ? 1 : 0),
      losses: before.losses + (input.result === "loss" ? 1 : 0),
      draws: before.draws + (input.result === "draw" ? 1 : 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,language" },
  );
  if (error) throw new Error(`Failed to update player rating: ${error.message}`);
}
