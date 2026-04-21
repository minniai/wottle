"use server";

import { z } from "zod";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { RecentGameRow } from "@/lib/types/lobby";

const inputSchema = z.object({
  playerId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(6),
});

interface MatchRow {
  id: string;
  player_a_id: string;
  player_b_id: string;
  winner_id: string | null;
  completed_at: string | null;
  player_a: { id: string; username: string; display_name: string | null } | null;
  player_b: { id: string; username: string; display_name: string | null } | null;
}

interface ScoreRow {
  match_id: string;
  round_number: number;
  player_a_score: number;
  player_b_score: number;
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
  const { playerId, limit } = inputSchema.parse(input);
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
        player_a:player_a_id (id, username, display_name),
        player_b:player_b_id (id, username, display_name)
      `,
    )
    .eq("state", "completed")
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent games: ${error.message}`);
  }

  const rows = (matches ?? []) as unknown as MatchRow[];
  if (rows.length === 0) return { games: [] };

  const matchIds = rows.map((r) => r.id);

  const { data: snaps, error: snapErr } = await supabase
    .from("scoreboard_snapshots")
    .select("match_id,round_number,player_a_score,player_b_score")
    .in("match_id", matchIds)
    .order("round_number", { ascending: false });

  if (snapErr) {
    throw new Error(`Failed to fetch scoreboards: ${snapErr.message}`);
  }

  const latestByMatch = new Map<string, ScoreRow>();
  for (const s of (snaps ?? []) as ScoreRow[]) {
    if (!latestByMatch.has(s.match_id)) {
      latestByMatch.set(s.match_id, s);
    }
  }

  const games: RecentGameRow[] = rows.map((row) => {
    const isPlayerA = row.player_a_id === playerId;
    const opponent = isPlayerA ? row.player_b : row.player_a;
    const snap = latestByMatch.get(row.id);
    const yourScore = snap
      ? isPlayerA
        ? snap.player_a_score
        : snap.player_b_score
      : 0;
    const oppScore = snap
      ? isPlayerA
        ? snap.player_b_score
        : snap.player_a_score
      : 0;

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
