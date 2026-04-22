"use server";

import "server-only";
import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";

export interface BestWordEntry {
  word: string;
  points: number;
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

export async function getBestWords(
  playerId: string,
  limit = 12,
): Promise<GetBestWordsResult> {
  const parsed = inputSchema.safeParse({ playerId, limit });
  if (!parsed.success) {
    return { status: "error", error: "Invalid input." };
  }

  const supabase = getServiceRoleClient();
  // Fetch more than we need, then dedupe client-side by (word, max total_points).
  // Simpler than expressing GROUP BY through the supabase-js query builder.
  const { data, error } = await supabase
    .from("word_score_entries")
    .select("word, total_points")
    .eq("player_id", parsed.data.playerId)
    .order("total_points", { ascending: false })
    .limit(parsed.data.limit * 4);

  if (error) {
    return { status: "error", error: "Lookup failed." };
  }

  const seen = new Set<string>();
  const words: BestWordEntry[] = [];
  for (const row of (data ?? []) as { word: string; total_points: number }[]) {
    if (seen.has(row.word)) continue;
    seen.add(row.word);
    words.push({ word: row.word, points: row.total_points });
    if (words.length >= parsed.data.limit) break;
  }

  return { status: "ok", words };
}
