import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";

import { PRIMARY_BOARD_ID } from "./constants";

interface VerifyOptions {
  probe?: () => Promise<void>;
  now?: () => number;
}

interface VerifyResult extends Record<string, unknown> {
  status: "healthy" | "error";
  durationMs: number;
  message?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function verifySupabase(options: VerifyOptions = {}): Promise<VerifyResult> {
  const now = options.now ?? (() => performance.now());
  const started = now();

  const probe =
    options.probe ??
    (async () => {
      const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
      const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

      const supabase = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const checks = await Promise.all([
        supabase
          .from("boards")
          .select("board_id")
          .eq("board_id", PRIMARY_BOARD_ID)
          .limit(1),
        supabase.from("players").select("id").limit(1),
        supabase.from("matches").select("id").limit(1),
        supabase.from("rounds").select("id").limit(1),
        supabase.from("move_submissions").select("id").limit(1),
        supabase.from("match_logs").select("id").limit(1),
        supabase.from("match_heartbeats").select("match_id").limit(1),
        // Spec 047 FR-005: the frozen-tiles compare-and-set function must exist.
        // The nil uuid matches no row, so the probe writes nothing and returns 0.
        supabase.rpc("update_frozen_tiles_if_unchanged", {
          p_match_id: "00000000-0000-0000-0000-000000000000",
          p_new_frozen_tiles: {},
          p_previous_frozen_tiles: {},
        }),
      ]);

      const failed = checks.find((result) => result.error);
      if (failed?.error) {
        throw failed.error;
      }
    });

  try {
    await probe();
    const durationMs = Math.round(now() - started);
    return { status: "healthy", durationMs };
  } catch (error) {
    const durationMs = Math.round(now() - started);
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", durationMs, message };
  }
}

function logStructured(event: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    })
  );
}

async function run() {
  try {
    const result = await verifySupabase();
    logStructured("supabase.verify.result", result);
    if (result.status !== "healthy") {
      process.exitCode = 1;
    }
  } catch (error) {
    logStructured("supabase.verify.crash", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
