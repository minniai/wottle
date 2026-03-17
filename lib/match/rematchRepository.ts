import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  RematchRequest,
  RematchRequestStatus,
} from "@/lib/types/match";

type AnyClient = SupabaseClient<any, any, any>;

function mapRow(row: any): RematchRequest {
  return {
    id: row.id,
    matchId: row.match_id,
    requesterId: row.requester_id,
    responderId: row.responder_id,
    status: row.status,
    newMatchId: row.new_match_id,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

export async function fetchRematchRequest(
  client: AnyClient,
  matchId: string,
): Promise<RematchRequest | null> {
  const { data, error } = await client
    .from("rematch_requests")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch rematch request: ${error.message}`,
    );
  }

  return data ? mapRow(data) : null;
}

export async function insertRematchRequest(
  client: AnyClient,
  matchId: string,
  requesterId: string,
  responderId: string,
): Promise<RematchRequest> {
  const { data, error } = await client
    .from("rematch_requests")
    .insert({
      match_id: matchId,
      requester_id: requesterId,
      responder_id: responderId,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to insert rematch request: ${error.message}`,
    );
  }

  return mapRow(data);
}

export async function updateRematchRequestStatus(
  client: AnyClient,
  requestId: string,
  status: RematchRequestStatus,
  newMatchId?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    responded_at: new Date().toISOString(),
  };
  if (newMatchId) {
    update.new_match_id = newMatchId;
  }

  const { error } = await client
    .from("rematch_requests")
    .update(update)
    .eq("id", requestId);

  if (error) {
    throw new Error(
      `Failed to update rematch request: ${error.message}`,
    );
  }
}

interface MatchChainRow {
  id: string;
  rematch_of: string | null;
  winner_id: string | null;
}

/**
 * Fetches all matches in the rematch chain for series context.
 * Walks backward from the given match through rematch_of links.
 */
export async function fetchMatchChainForSeries(
  client: AnyClient,
  matchId: string,
): Promise<{ id: string; rematchOf: string | null; winnerId: string | null }[]> {
  const results: { id: string; rematchOf: string | null; winnerId: string | null }[] = [];
  let currentId: string | null = matchId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const { data, error } = await client
      .from("matches")
      .select("id,rematch_of,winner_id")
      .eq("id", currentId)
      .maybeSingle();

    if (error || !data) break;

    const row = data as MatchChainRow;
    results.unshift({
      id: row.id,
      rematchOf: row.rematch_of,
      winnerId: row.winner_id,
    });

    currentId = row.rematch_of;
  }

  return results;
}
