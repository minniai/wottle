import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";

import { BASELINE_GRID, PRIMARY_BOARD_ID } from "./constants";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function seedBoard() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const started = performance.now();

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
      .update({ grid: BASELINE_GRID })
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabase.from("boards").insert({
      board_id: PRIMARY_BOARD_ID,
      grid: BASELINE_GRID,
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
  };
}

async function getBoardId(supabase: ReturnType<typeof createClient>) {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  seedBoard()
    .then(({ durationMs }) => {
      console.log(
        JSON.stringify({
          event: "supabase.seed.success",
          durationMs,
          boardId: PRIMARY_BOARD_ID,
          timestamp: new Date().toISOString(),
        })
      );
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "supabase.seed.error",
          message: error.message,
          stack: error.stack,
          boardId: PRIMARY_BOARD_ID,
          timestamp: new Date().toISOString(),
        })
      );
      process.exitCode = 1;
    });
}

export { seedBoard };
