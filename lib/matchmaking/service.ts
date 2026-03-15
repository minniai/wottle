import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  LobbyPresence,
  LobbyStatus,
  MatchState,
  PlayerIdentity,
  ScoreTotals,
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
}

interface MatchBootstrapInput {
  id?: string;
  boardSeed: string;
  playerAId: string;
  playerBId: string;
  roundLimit?: number;
  rematchOf?: string;
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

export async function bootstrapMatchRecord(
  client: AnyClient,
  input: MatchBootstrapInput
): Promise<string> {
  const payload: Record<string, unknown> = {
    id: input.id,
    board_seed: input.boardSeed,
    player_a_id: input.playerAId,
    player_b_id: input.playerBId,
    round_limit: input.roundLimit ?? 10,
    state: "pending",
  };

  if (input.rematchOf) {
    payload.rematch_of = input.rematchOf;
  }

  const { data, error } = await client
    .from("matches")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create match record: ${error.message}`);
  }

  return data.id;
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

export async function recordScoreSnapshot(
  client: AnyClient,
  matchId: string,
  roundNumber: number,
  scores: ScoreTotals,
  deltas: ScoreTotals
): Promise<void> {
  const { error } = await client.from("scoreboard_snapshots").upsert(
    {
      match_id: matchId,
      round_number: roundNumber,
      player_a_score: scores.playerA,
      player_b_score: scores.playerB,
      player_a_delta: deltas.playerA,
      player_b_delta: deltas.playerB,
    },
    { onConflict: "match_id,round_number" }
  );

  if (error) {
    throw new Error(`Failed to persist scoreboard snapshot: ${error.message}`);
  }
}

export async function fetchMatchState(
  client: AnyClient,
  matchId: string
): Promise<MatchState | null> {
  const { data, error } = await client
    .from("matches")
    .select(
      `
        id,
        board_seed,
        state,
        current_round,
        player_a_id,
        player_b_id,
        player_a_timer_ms,
        player_b_timer_ms
      `
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch match ${matchId}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    matchId: data.id,
    board: [],
    currentRound: data.current_round,
    state: data.state,
    timers: {
      playerA: {
        playerId: data.player_a_id,
        remainingMs: data.player_a_timer_ms,
        status: "running",
      },
      playerB: {
        playerId: data.player_b_id,
        remainingMs: data.player_b_timer_ms,
        status: "running",
      },
    },
    scores: { playerA: 0, playerB: 0 },
    lastSummary: null,
  };
}

