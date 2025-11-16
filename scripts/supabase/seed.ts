import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { PRIMARY_BOARD_ID } from "./constants";
import { generateBoard } from "./generateBoard";

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createServiceRoleClient(): AnySupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function seedBoard(supabaseParam?: AnySupabaseClient) {
  const supabase = supabaseParam ?? createServiceRoleClient();
  const started = performance.now();
  const matchId = process.env.BOARD_MATCH_ID ?? `board-${Date.now()}`;
  const grid = generateBoard({ matchId });

  const { data: existing, error: fetchError } = await supabase
    .from("boards")
    .select("id")
    .eq("board_id", PRIMARY_BOARD_ID)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `boards.select: ${fetchError.message ?? JSON.stringify(fetchError)}`
    );
  }

  let boardId: string;

  if (existing) {
    boardId = existing.id;
    const { error: updateError } = await supabase
      .from("boards")
      .update({ grid })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(
        `boards.update: ${updateError.message ?? JSON.stringify(updateError)}`
      );
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("boards")
      .insert({
        board_id: PRIMARY_BOARD_ID,
        grid,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(
        `boards.insert: ${insertError.message ?? JSON.stringify(insertError)}`
      );
    }

    boardId = inserted.id;
  }

  const { error: cleanupError } = await supabase
    .from("moves")
    .delete()
    .eq("board_id", boardId);

  if (cleanupError) {
    throw new Error(
      `moves.delete: ${cleanupError.message ?? JSON.stringify(cleanupError)}`
    );
  }

  return {
    durationMs: Math.round(performance.now() - started),
    matchId,
    grid,
  };
}

async function seedPlaytestFixtures(
  supabase: AnySupabaseClient,
  grid: string[][]
) {
  const started = performance.now();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const nowIso = new Date().toISOString();
  const playersPayload = [
    {
      username: "playtest-alpha",
      display_name: "Playtest Alpha",
      status: "available",
      last_seen_at: nowIso,
    },
    {
      username: "playtest-beta",
      display_name: "Playtest Beta",
      status: "available",
      last_seen_at: nowIso,
    },
  ];
  const { data: players, error: playerError } = await supabase
    .from("players")
    .upsert(playersPayload, { onConflict: "username" })
    .select("id, username");

  if (playerError || !players) {
    throw new Error(
      `players.upsert: ${
        playerError?.message ?? JSON.stringify(playerError ?? "missing response")
      }`
    );
  }

  const [playerA, playerB] = players;

  const matchId = randomUUID();
  const { error: matchError } = await supabase.from("matches").upsert(
    {
      id: matchId,
      board_seed: matchId,
      player_a_id: playerA.id,
      player_b_id: playerB.id,
      state: "pending",
      round_limit: 10,
    },
    { onConflict: "id" }
  );

  if (matchError) {
    throw new Error(
      `matches.upsert: ${matchError.message ?? JSON.stringify(matchError)}`
    );
  }

  const { error: roundError } = await supabase.from("rounds").upsert(
    {
      match_id: matchId,
      round_number: 1,
      state: "collecting",
      board_snapshot_before: grid,
    },
    { onConflict: "match_id,round_number" }
  );

  if (roundError) {
    throw new Error(
      `rounds.upsert: ${roundError.message ?? JSON.stringify(roundError)}`
    );
  }

  const { error: presenceError } = await supabase.from("lobby_presence").upsert(
    players.map((player) => ({
      player_id: player.id,
      connection_id: randomUUID(),
      mode: "auto",
      invite_token: null,
      expires_at: expiresAt,
    })),
    { onConflict: "player_id" }
  );

  if (presenceError) {
    throw new Error(
      `lobby_presence.upsert: ${
        presenceError.message ?? JSON.stringify(presenceError)
      }`
    );
  }

  return {
    durationMs: Math.round(performance.now() - started),
    matchId,
  };
}

async function seed() {
  const supabase = createServiceRoleClient();

  const boardResult = await seedBoard(supabase);
  const playtestResult = await seedPlaytestFixtures(supabase, boardResult.grid);

  console.log(
    JSON.stringify({
      event: "supabase.seed.success",
      boardDurationMs: boardResult.durationMs,
      playtestDurationMs: playtestResult.durationMs,
      boardMatchId: boardResult.matchId,
      demoMatchId: playtestResult.matchId,
      boardId: PRIMARY_BOARD_ID,
      timestamp: new Date().toISOString(),
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error) => {
    console.error(
      JSON.stringify({
        event: "supabase.seed.error",
        message:
          error instanceof Error
            ? error.message
            : typeof error === "object"
              ? JSON.stringify(error)
              : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        boardId: PRIMARY_BOARD_ID,
        timestamp: new Date().toISOString(),
      })
    );
    process.exitCode = 1;
  });
}

export { seedBoard };
