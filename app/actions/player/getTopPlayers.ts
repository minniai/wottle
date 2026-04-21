"use server";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { TopPlayerRow } from "@/lib/types/lobby";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(6),
});

export async function getTopPlayers(
  input: z.input<typeof inputSchema>,
): Promise<{ players: TopPlayerRow[] }> {
  const { limit } = inputSchema.parse(input);
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("players")
    .select("id,username,display_name,elo_rating,avatar_url")
    .order("elo_rating", { ascending: false })
    .order("username", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch top players: ${error.message}`);
  }

  const rows: TopPlayerRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    username: r.username as string,
    displayName: (r.display_name as string) ?? (r.username as string),
    eloRating: Number(r.elo_rating ?? 0),
    avatarUrl: (r.avatar_url as string | null) ?? null,
    wins: 0,
    losses: 0,
  }));

  return { players: rows };
}
