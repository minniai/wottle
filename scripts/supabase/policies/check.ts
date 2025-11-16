import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { Client } from "pg";

const OUTPUT_PATH = resolve("supabase/policies/policies.snapshot.json");

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const TABLES = [
  "boards",
  "moves",
  "players",
  "lobby_presence",
  "match_invitations",
  "matches",
  "rounds",
  "move_submissions",
  "word_score_entries",
  "scoreboard_snapshots",
  "match_logs",
];

async function fetchPolicies() {
  const password = requireEnv("SUPABASE_DB_PASSWORD", "postgres");
  const host = process.env.SUPABASE_DB_HOST ?? "127.0.0.1";
  const port = Number(process.env.SUPABASE_DB_PORT ?? "54322");
  const user = process.env.SUPABASE_DB_USER ?? "postgres";
  const database = process.env.SUPABASE_DB_NAME ?? "postgres";

  const client = new Client({ host, port, user, password, database });
  await client.connect();
  try {
    const { rows } = await client.query(
      `
        select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        from pg_policies
        where schemaname = 'public' and tablename = any($1)
        order by tablename, policyname;
      `,
      [TABLES]
    );
    return rows;
  } finally {
    await client.end();
  }
}

async function run() {
  const policies = await fetchPolicies();
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), policies }, null, 2)
  );
  console.log(
    JSON.stringify({
      event: "supabase.policies.snapshot",
      output: OUTPUT_PATH,
      count: policies.length,
      timestamp: new Date().toISOString(),
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(
      JSON.stringify({
        event: "supabase.policies.error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      })
    );
    process.exitCode = 1;
  });
}

export { fetchPolicies };
