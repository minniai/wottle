import { createClient } from "@supabase/supabase-js";

import { expireStaleInvites } from "@/lib/matchmaking/inviteService";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function run() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ttlSeconds = Number(process.env.PLAYTEST_INVITE_EXPIRY_SECONDS ?? "30");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const expiredIds = await expireStaleInvites(supabase, {
    ttlSeconds,
  });

  console.log(
    JSON.stringify({
      event: "inviteTimeout.completed",
      expired: expiredIds.length,
      timestamp: new Date().toISOString(),
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(
      JSON.stringify({
        event: "inviteTimeout.failed",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    process.exitCode = 1;
  });
}


