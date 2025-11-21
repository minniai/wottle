#!/usr/bin/env tsx

import { createServiceRoleClient } from "../../lib/supabase/server";

async function exportLogs(matchId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("match_logs")
    .select("match_id, event_type, payload, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }

  return data ?? [];
}

async function main() {
  const [, , matchId] = process.argv;
  if (!matchId) {
    console.error("Usage: tsx scripts/supabase/log-export.ts <matchId>");
    process.exit(1);
  }

  try {
    const logs = await exportLogs(matchId);
    console.log(JSON.stringify({ matchId, events: logs }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

void main();

