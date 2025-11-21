"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, any, any>;

export interface MatchLogPayload {
  matchId: string;
  eventType:
    | "match.completed"
    | "match.timeout"
    | "match.disconnect"
    | "match.rematch.requested"
    | "match.rematch.created"
    | (string & {});
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeMatchLog(client: AnyClient, payload: MatchLogPayload) {
  const { error } = await client.from("match_logs").insert({
    match_id: payload.matchId,
    event_type: payload.eventType,
    payload: {
      actorId: payload.actorId ?? null,
      metadata: payload.metadata ?? {},
    },
  });

  if (error) {
    console.error("[MatchLog] Failed to insert log entry:", error);
  }
}

