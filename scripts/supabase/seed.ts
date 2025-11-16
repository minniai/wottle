import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    throw fetchError;
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("boards")
      .update({ grid })
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabase.from("boards").insert({
      board_id: PRIMARY_BOARD_ID,
      grid,
    });

    if (insertError) {
      throw insertError;
    }
  }

  const { error: cleanupError } = await supabase
    .from("moves")
    .delete()
    .eq("board_id", existing?.id ?? (await getBoardId(supabase)));

  if (cleanupError) {
    throw cleanupError;
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

  const playersPayload = [
    { username: "playtest-alpha", display_name: "Playtest Alpha" },
    { username: "playtest-beta", display_name: "Playtest Beta" },
  ];
  const { data: players, error: playerError } = await supabase
    .from("players")
    .upsert(playersPayload, { onConflict: "username" })
    .select("id, username");

  if (playerError || !players) {
    throw playerError ?? new Error("Failed to seed playtest players");
  }

  const [playerA, playerB] = players;

  const matchId = "playtest-demo-match";
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
    throw matchError;
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
    throw roundError;
  }

  const { error: presenceError } = await supabase.from("lobby_presence").upsert(
    players.map((player, index) => ({
      player_id: player.id,
      connection_id: `demo-connection-${index}`,
      mode: "auto",
      invite_token: null,
      expires_at: expiresAt,
    })),
    { onConflict: "player_id" }
  );

  if (presenceError) {
    throw presenceError;
  }

  return {
    durationMs: Math.round(performance.now() - started),
    matchId,
  };
}

async function getBoardId(supabase: AnySupabaseClient) {
  const { data, error } = await supabase
    .from("boards")
    .select("id")
    .eq("board_id", PRIMARY_BOARD_ID)
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("Failed to fetch board id after insert");
  }
  return data.id;
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
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        boardId: PRIMARY_BOARD_ID,
        timestamp: new Date().toISOString(),
      })
    );
    process.exitCode = 1;
  });
}

export { seedBoard };
