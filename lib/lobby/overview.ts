import "server-only";

import { lobbyNumbers, playerPresence } from "@/lib/presence/presenceService";
import { readEloRatings } from "@/lib/rating/playerRatings";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { FormResult, LastMatch, LobbyCounts, LobbyLanguage, Overview } from "@/lib/types/standing";

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

const FORM_LENGTH = 10;
const RESULT: Record<string, FormResult> = { win: "W", loss: "L", draw: "D" };

interface LastMatchRow {
  id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  started_at: string | null;
  completed_at: string;
  player_a_score: number | null;
  player_b_score: number | null;
  board: string[][] | null;
  player_a: { display_name: string } | null;
  player_b: { display_name: string } | null;
}

async function lastMatch(playerId: string, language: LobbyLanguage): Promise<LastMatch | null> {
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("matches")
    .select("id, player_a_id, player_b_id, winner_id, started_at, completed_at, player_a_score, player_b_score, board, player_a:player_a_id (display_name), player_b:player_b_id (display_name)")
    .eq("state", "completed")
    .eq("language", language)
    .or("ended_reason.is.null,ended_reason.not.in.(void,abandoned)")
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`last match: ${error.message}`);
  const row = data as unknown as LastMatchRow | null;
  if (!row) return null;
  const isA = row.player_a_id === playerId;
  const bands = await bandsInScoringOrder(row.id, playerId);
  return {
    matchId: row.id,
    opponent: (isA ? row.player_b : row.player_a)?.display_name ?? "",
    you: (isA ? row.player_a_score : row.player_b_score) ?? 0,
    them: (isA ? row.player_b_score : row.player_a_score) ?? 0,
    durationMs: row.started_at ? Date.parse(row.completed_at) - Date.parse(row.started_at) : null,
    completedAt: row.completed_at,
    youWon: row.winner_id === null ? null : row.winner_id === playerId,
    bands,
    board: row.board,
  };
}

interface WordRow {
  player_id: string;
  tiles: Array<{ x: number; y: number }>;
  move: { global_seq: number } | null;
}

async function bandsInScoringOrder(matchId: string, playerId: string): Promise<LastMatch["bands"]> {
  const { data } = await getServiceRoleClient()
    .from("word_score_entries")
    .select("player_id, tiles, move:move_id (global_seq)")
    .eq("match_id", matchId);
  const rows = (data ?? []) as unknown as WordRow[];
  return rows
    .sort((a, b) => (a.move?.global_seq ?? 0) - (b.move?.global_seq ?? 0))
    .map((w) => ({ tiles: w.tiles, seat: w.player_id === playerId ? "you" : "opp" }));
}

async function form(playerId: string, language: LobbyLanguage): Promise<FormResult[]> {
  const { data } = await getServiceRoleClient()
    .from("match_ratings")
    .select("match_result, created_at")
    .eq("player_id", playerId)
    .eq("language", language)
    .order("created_at", { ascending: false })
    .limit(FORM_LENGTH);
  return (data ?? []).map((r) => RESULT[r.match_result as string]).filter(Boolean).reverse();
}

/** With a session: the counts, the last match (for the band map) and the last ten, oldest first (US10). */
export async function viewerOverview(playerId: string, language: LobbyLanguage): Promise<Overview> {
  const [counts, last, results] = await Promise.all([lobbyCounts(language), lastMatch(playerId, language), form(playerId, language)]);
  return { counts, lastMatch: last, form: results };
}
