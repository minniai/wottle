import { NextResponse } from "next/server";
import { z } from "zod";

import { loadMatchWordHistory, type MatchWordHistory } from "@/lib/match/wordHistory";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

const NO_CACHE_HEADERS = { "cache-control": "no-store" };
const matchIdSchema = z.string().uuid();

type MatchAccessRow = {
  player_a_id: string;
  player_b_id: string;
  state: string;
};

function reject(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_CACHE_HEADERS });
}

/**
 * Every resolved move's scored words for one match (spec 047 FR-003, spec 050). The
 * room fetches it once on mount, on a rematch and after a missed broadcast;
 * a completed match is readable by anyone signed in, as the read-only room is.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await readLobbySession();
  if (!session) return reject(401, "Authentication required.");
  if (!matchIdSchema.safeParse(matchId).success) return reject(400, "Invalid match id.");

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .select("player_a_id, player_b_id, state")
    .eq("id", matchId)
    .single();
  const match = (data ?? null) as MatchAccessRow | null;
  if (error || !match) return reject(404, "Match not found.");

  const playerId = session.player.id;
  const isParticipant = playerId === match.player_a_id || playerId === match.player_b_id;
  if (!isParticipant && match.state !== "completed") return reject(403, "You are not a participant in this match.");

  const words = await loadMatchWordHistory(supabase, matchId);
  const body: MatchWordHistory = { matchId, words };
  return NextResponse.json(body, { status: 200, headers: NO_CACHE_HEADERS });
}
