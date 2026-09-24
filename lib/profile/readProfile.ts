import "server-only";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { readRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { Language } from "@/lib/types/game-config";
import type { ProfileView, RatingEvent } from "@/lib/types/profile";
import type { FormResult } from "@/lib/types/standing";

import { toProfileWords } from "./bestWords";
import { chartSeries } from "./chartSeries";
import { bestWords, presenceWord } from "./profileRepository";
import { readHandle } from "./readHandle";
import { winRateOf } from "./record";
import { weekChange } from "./weekChange";

const RECENT = 8;
const FORM: Record<string, FormResult> = { win: "W", loss: "L", draw: "D" };

export type ProfileMode = { kind: "own" } | { kind: "public"; viewerId: string | null };

interface RatingRow {
  rating_before: number;
  rating_after: number;
  match_result: string;
  created_at: string;
}

const otherOf = (language: Language): Language => (language === "is" ? "en" : "is");

/** Every rated match of this player in this language, oldest first. */
async function ratingRows(playerId: string, language: Language): Promise<RatingRow[]> {
  const { data, error } = await getServiceRoleClient()
    .from("match_ratings")
    .select("rating_before, rating_after, match_result, created_at")
    .eq("player_id", playerId)
    .eq("language", language)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`match_ratings: ${error.message}`);
  return (data ?? []) as RatingRow[];
}

/** The player a handle names, or null. Encoded, unencoded and decomposed forms read alike (FR-047). */
export async function playerIdForHandle(raw: string): Promise<string | null> {
  const handle = readHandle(raw).toLowerCase();
  if (!handle || handle.length > 64) return null;
  const { data } = await getServiceRoleClient().from("players").select("id").eq("username", handle).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * A profile in one language (spec 072 FR-030–FR-045, research R13): one round
 * of parallel reads, returned as a `ProfileView`, which never carries a
 * last-seen time, a status or an avatar. Null when no player has this id.
 */
export async function readProfile(playerId: string, language: Language, mode: ProfileMode, now = new Date()): Promise<ProfileView | null> {
  const client = getServiceRoleClient();
  const other = otherOf(language);
  const opponentId = mode.kind === "public" && mode.viewerId && mode.viewerId !== playerId ? mode.viewerId : undefined;
  const [player, ratings, others, rows, words, recent, presence] = await Promise.all([
    client.from("players").select("id, username, display_name").eq("id", playerId).maybeSingle(),
    readRatings(client, [playerId], language),
    readRatings(client, [playerId], other),
    ratingRows(playerId, language),
    bestWords(playerId, language),
    mode.kind === "public" && !opponentId ? Promise.resolve({ games: [] }) : getRecentGames({ playerId, limit: RECENT, language, opponentId }),
    mode.kind === "public" ? presenceWord(playerId, language) : Promise.resolve(null),
  ]);
  if (!player.data) return null;
  const record = ratings.get(playerId)!;
  const events: RatingEvent[] = rows.map((r) => ({ at: r.created_at, before: r.rating_before, after: r.rating_after }));
  const otherRecord = others.get(playerId)!;
  const chart = chartSeries(events, record.eloRating, now);
  return {
    playerId,
    handle: player.data.username as string,
    displayName: player.data.display_name as string,
    language,
    rating: record.eloRating,
    peak: Math.max(record.eloRating, ...rows.map((r) => r.rating_after)),
    weekChange: weekChange(events, record.eloRating, now),
    matches: record.gamesPlayed,
    firstPlayedAt: rows[0]?.created_at ?? null,
    record: { won: record.wins, lost: record.losses, drawn: record.draws, winRate: winRateOf(record.wins, record.losses, record.draws) },
    lastTen: rows.slice(-10).map((r) => FORM[r.match_result] ?? "D"),
    chart: chart.points,
    chartEmpty: chart.empty,
    bestWords: toProfileWords(words, language),
    otherLanguage: { language: other, rating: otherRecord.eloRating, matches: otherRecord.gamesPlayed },
    matchesList: recent.games,
    presence,
  };
}
