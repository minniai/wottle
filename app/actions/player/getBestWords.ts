"use server";

import type { Language } from "@/lib/types/game-config";
import "server-only";
import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";

export interface BestWordEntry {
  word: string;
  points: number;
  /** Display name of the opponent in the match where the word scored (spec 044 US10). */
  opponentName?: string;
}

export interface GetBestWordsResult {
  status: "ok" | "error";
  words?: BestWordEntry[];
  error?: string;
}

const inputSchema = z.object({
  playerId: z.string().uuid(),
  limit: z.number().int().positive().max(100).default(12),
});

interface EntryRow {
  word: string;
  total_points: number;
  match_id: string | null;
}

/** Best distinct words by points, each with the opponent it was scored against. */
/** The player's best words in one language (spec 060). */
export async function getBestWords(playerId: string, limit = 12, language: Language = "is"): Promise<GetBestWordsResult> {
  const parsed = inputSchema.safeParse({ playerId, limit });
  if (!parsed.success) {
    return { status: "error", error: "Invalid input." };
  }

  const supabase = getServiceRoleClient();
  // Fetch more than we need, then dedupe by (word, max total_points).
  const { data, error } = await supabase
    .from("word_score_entries")
    .select("word, total_points, match_id, matches!inner(language)")
    .eq("player_id", parsed.data.playerId)
    .eq("matches.language", language)
    .order("total_points", { ascending: false })
    .limit(parsed.data.limit * 4);

  if (error) {
    return { status: "error", error: "Lookup failed." };
  }

  const seen = new Set<string>();
  const picked: EntryRow[] = [];
  for (const row of (data ?? []) as EntryRow[]) {
    if (seen.has(row.word)) continue;
    seen.add(row.word);
    picked.push(row);
    if (picked.length >= parsed.data.limit) break;
  }

  const opponentByMatch = await resolveOpponents(supabase, parsed.data.playerId, picked.map((r) => r.match_id));
  const words = picked.map((row) => ({
    word: row.word,
    points: row.total_points,
    opponentName: row.match_id ? opponentByMatch.get(row.match_id) : undefined,
  }));
  return { status: "ok", words };
}

async function resolveOpponents(
  supabase: ReturnType<typeof getServiceRoleClient>,
  playerId: string,
  matchIds: Array<string | null>,
): Promise<Map<string, string>> {
  const ids = [...new Set(matchIds.filter((id): id is string => Boolean(id)))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;

  const { data: matches } = await supabase.from("matches").select("id, player_a_id, player_b_id").in("id", ids);
  const opponentIds = new Map<string, string>();
  for (const m of (matches ?? []) as Array<{ id: string; player_a_id: string; player_b_id: string }>) {
    opponentIds.set(m.id, m.player_a_id === playerId ? m.player_b_id : m.player_a_id);
  }
  const playerIds = [...new Set(opponentIds.values())];
  if (playerIds.length === 0) return out;

  const { data: players } = await supabase.from("players").select("id, display_name, username").in("id", playerIds);
  const nameById = new Map<string, string>();
  for (const p of (players ?? []) as Array<{ id: string; display_name: string | null; username: string }>) {
    nameById.set(p.id, p.display_name || p.username);
  }
  for (const [matchId, oppId] of opponentIds) {
    const name = nameById.get(oppId);
    if (name) out.set(matchId, name);
  }
  return out;
}
