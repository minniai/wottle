"use server";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { RecentGameRow } from "@/lib/types/lobby";

const inputSchema = z.object({
  playerId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(6),
  /** Spec 060: only matches played in this language. */
  language: z.enum(["is", "en", "se", "no", "dk"]).default("is"),
});

interface MatchRow {
  id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  completed_at: string | null;
  player_a_score: number | null;
  player_b_score: number | null;
  player_a: { id: string; username: string; display_name: string | null } | null;
  player_b: { id: string; username: string; display_name: string | null } | null;
}

function computeResult(
  winnerId: string | null,
  currentPlayerId: string,
): "win" | "loss" | "draw" {
  if (!winnerId) return "draw";
  return winnerId === currentPlayerId ? "win" : "loss";
}

export async function getRecentGames(
  input: z.input<typeof inputSchema>,
): Promise<{ games: RecentGameRow[] }> {
  const { playerId, limit, language } = inputSchema.parse(input);
  const supabase = getServiceRoleClient();

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `
        id,
        player_a_id,
        player_b_id,
        winner_id,
        completed_at,
        player_a_score,
        player_b_score,
        player_a:player_a_id (id, username, display_name),
        player_b:player_b_id (id, username, display_name)
      `,
    )
    .eq("state", "completed")
    // Spec 069 FR-016: a void table was never a match; spec 070 FR-039: nor is an abandoned one.
    .or("ended_reason.is.null,ended_reason.not.in.(void,abandoned)")
    .eq("language", language)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent games: ${error.message}`);
  }

  const rows = (matches ?? []) as unknown as MatchRow[];
  if (rows.length === 0) return { games: [] };

  const games: RecentGameRow[] = rows.map((row) => {
    const isPlayerA = row.player_a_id === playerId;
    const opponent = isPlayerA ? row.player_b : row.player_a;
    // Spec 050: the running totals live on the match row.
    const yourScore = (isPlayerA ? row.player_a_score : row.player_b_score) ?? 0;
    const oppScore = (isPlayerA ? row.player_b_score : row.player_a_score) ?? 0;

    return {
      matchId: row.id,
      result: computeResult(row.winner_id, playerId),
      opponentId: opponent?.id ?? "unknown",
      opponentUsername: opponent?.username ?? "unknown",
      opponentDisplayName:
        opponent?.display_name ?? opponent?.username ?? "Unknown",
      yourScore,
      opponentScore: oppScore,
      wordsFound: 0,
      completedAt: row.completed_at ?? new Date(0).toISOString(),
    };
  });

  return { games };
}
