import type { Language } from "@/lib/types/game-config";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  LobbyPresence,
  LobbyStatus,
  PlayerIdentity,
} from "@/lib/types/match";

type AnyClient = SupabaseClient<any, any, any>;

interface UpsertPlayerInput {
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  status?: LobbyStatus;
}

interface PresenceInput {
  playerId: string;
  connectionId: string;
  mode: "auto" | "direct_invite";
  inviteToken?: string | null;
  expiresAt: Date;
  /** The lobby the player is present in (spec 060); left as it is when omitted. */
  language?: Language;
}

export interface ActiveMatchSummary {
  id: string;
  state: "pending" | "in_progress";
}

function mapPlayer(row: any): PlayerIdentity {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    eloRating: row.elo_rating,
  };
}

export async function upsertPlayerIdentity(
  client: AnyClient,
  input: UpsertPlayerInput
): Promise<PlayerIdentity> {
  const displayName = input.displayName ?? input.username;
  const status = input.status ?? "available";

  const { data, error } = await client
    .from("players")
    .upsert(
      {
        username: input.username,
        display_name: displayName,
        avatar_url: input.avatarUrl ?? null,
        status,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "username" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert player identity: ${error.message}`);
  }

  return mapPlayer(data);
}

export async function upsertLobbyPresence(
  client: AnyClient,
  input: PresenceInput
): Promise<LobbyPresence> {
  const { data, error } = await client
    .from("lobby_presence")
    .upsert(
      {
        player_id: input.playerId,
        connection_id: input.connectionId,
        mode: input.mode,
        invite_token: input.inviteToken ?? null,
        expires_at: input.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
        ...(input.language ? { language: input.language } : {}),
      },
      { onConflict: "player_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert lobby presence: ${error.message}`);
  }

  return {
    playerId: data.player_id,
    connectionId: data.connection_id,
    mode: data.mode,
    inviteToken: data.invite_token,
    expiresAt: data.expires_at,
  };
}

export async function clearLobbyPresence(
  client: AnyClient,
  playerId: string
): Promise<void> {
  const { error } = await client
    .from("lobby_presence")
    .delete()
    .eq("player_id", playerId);

  if (error) {
    throw new Error(`Failed to clear lobby presence: ${error.message}`);
  }
}

export async function expireLobbyPresence(
  client: AnyClient,
  playerId: string
): Promise<void> {
  // Delete the record immediately for faster propagation
  const { error } = await client
    .from("lobby_presence")
    .delete()
    .eq("player_id", playerId);

  if (error) {
    throw new Error(`Failed to expire lobby presence: ${error.message}`);
  }
}

export async function findActiveMatchForPlayer(
  client: AnyClient,
  playerId: string
): Promise<ActiveMatchSummary | null> {
  const { data, error } = await client
    .from("matches")
    .select("id,state,created_at")
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .in("state", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check active match: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    state: data.state as "pending" | "in_progress",
  };
}


