#!/usr/bin/env tsx
/**
 * Debug script to check presence records in the database
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPresence() {
  console.log("\n=== Checking Lobby Presence Records ===\n");

  // 1. Check raw presence records
  const { data: presenceRecords, error: presenceError } = await supabase
    .from("lobby_presence")
    .select("*")
    .order("updated_at", { ascending: false });

  if (presenceError) {
    console.error("Error fetching presence records:", presenceError);
  } else {
    console.log(`Found ${presenceRecords?.length || 0} presence records:`);
    presenceRecords?.forEach((record) => {
      const now = new Date();
      const expiresAt = new Date(record.expires_at);
      const isExpired = expiresAt <= now;
      console.log(`  - Player ${record.player_id}`);
      console.log(`    Connection: ${record.connection_id}`);
      console.log(`    Expires: ${record.expires_at} ${isExpired ? "(EXPIRED)" : "(active)"}`);
      console.log(`    Updated: ${record.updated_at}`);
    });
  }

  // 2. Check presence with player join (like fetchLobbySnapshot does)
  console.log("\n=== Checking Presence with Player Join ===\n");

  const { data: joinedData, error: joinError } = await supabase
    .from("lobby_presence")
    .select(
      `
        player:player_id (
          id,
          username,
          display_name,
          status,
          last_seen_at
        )
      `
    )
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false });

  if (joinError) {
    console.error("Error with joined query:", joinError);
  } else {
    console.log(`Query returned ${joinedData?.length || 0} records:`);
    joinedData?.forEach((record: any) => {
      console.log(`  - Player: ${JSON.stringify(record.player, null, 2)}`);
    });
  }

  // 3. Check players table
  console.log("\n=== Checking Players Table ===\n");

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(10);

  if (playersError) {
    console.error("Error fetching players:", playersError);
  } else {
    console.log(`Found ${players?.length || 0} recent players:`);
    players?.forEach((player) => {
      console.log(`  - ${player.username} (${player.id})`);
      console.log(`    Status: ${player.status}`);
      console.log(`    Last seen: ${player.last_seen_at}`);
    });
  }

  console.log("\n=== End Debug ===\n");
}

checkPresence().catch(console.error);

