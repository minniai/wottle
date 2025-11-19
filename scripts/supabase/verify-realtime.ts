#!/usr/bin/env tsx
/**
 * Verification script for Supabase Realtime configuration
 * 
 * This script checks that the required tables are properly configured
 * for Realtime replication and published to the supabase_realtime publication.
 * 
 * Usage:
 *   tsx scripts/supabase/verify-realtime.ts
 */

import { createClient } from "@supabase/supabase-js";

const REQUIRED_TABLES = [
  "lobby_presence",
  "matches",
  "rounds",
  "move_submissions",
  "match_invitations",
];

interface PublicationTable {
  schemaname: string;
  tablename: string;
  pubname: string;
}

interface ReplicaIdentity {
  schemaname: string;
  tablename: string;
  relreplident: string;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables:");
    console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
    console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔍 Verifying Realtime Configuration...\n");

  // Check publication tables
  console.log("📡 Checking supabase_realtime publication:");
  const { data: pubTables, error: pubError } = await supabase.rpc("sql", {
    query: `
      SELECT schemaname, tablename, pubname
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      ORDER BY tablename;
    `,
  }) as { data: PublicationTable[] | null; error: any };

  if (pubError) {
    console.error("   ❌ Failed to query publication tables:", pubError);
    // Try alternative method using direct SQL
    const { data: altData, error: altError } = await supabase
      .from("pg_publication_tables")
      .select("*")
      .eq("pubname", "supabase_realtime");
    
    if (altError) {
      console.error("   ❌ Alternative query also failed:", altError);
      console.log("\n💡 Tip: You may need to run this script with direct database access");
      console.log("   Try: psql $DATABASE_URL -c \"SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';\"");
    }
  } else {
    const publishedTables = new Set(pubTables?.map((t) => t.tablename) || []);
    
    for (const table of REQUIRED_TABLES) {
      if (publishedTables.has(table)) {
        console.log(`   ✅ ${table} - published`);
      } else {
        console.log(`   ❌ ${table} - NOT published`);
      }
    }
  }

  // Check replica identity
  console.log("\n🔄 Checking replica identity settings:");
  const { data: replicaTables, error: replicaError } = await supabase.rpc("sql", {
    query: `
      SELECT n.nspname as schemaname, c.relname as tablename, c.relreplident
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('${REQUIRED_TABLES.join("','")}')
      ORDER BY c.relname;
    `,
  }) as { data: ReplicaIdentity[] | null; error: any };

  if (replicaError) {
    console.error("   ❌ Failed to query replica identity:", replicaError);
  } else {
    for (const table of REQUIRED_TABLES) {
      const config = replicaTables?.find((t) => t.tablename === table);
      if (!config) {
        console.log(`   ❌ ${table} - table not found`);
        continue;
      }

      const identityType = {
        d: "default (primary key only)",
        f: "full (all columns)",
        n: "nothing (disabled)",
        i: "index",
      }[config.relreplident] || "unknown";

      const isGood = config.relreplident === "f";
      const status = isGood ? "✅" : "⚠️";
      console.log(`   ${status} ${table} - ${identityType}`);

      if (!isGood) {
        console.log(`      💡 Run: ALTER TABLE public.${table} REPLICA IDENTITY FULL;`);
      }
    }
  }

  // Test realtime connection
  console.log("\n🔌 Testing Realtime connection:");
  try {
    const channel = supabase.channel("test-verification-channel");
    
    let subscribed = false;
    let error: Error | null = null;

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("   ✅ Successfully subscribed to Realtime channel");
          subscribed = true;
          resolve();
        } else if (status === "CHANNEL_ERROR") {
          console.log("   ❌ Channel subscription failed (CHANNEL_ERROR)");
          error = new Error("CHANNEL_ERROR");
          resolve();
        } else if (status === "TIMED_OUT") {
          console.log("   ❌ Channel subscription timed out");
          error = new Error("TIMED_OUT");
          resolve();
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!subscribed && !error) {
          console.log("   ⚠️  Channel subscription timed out after 10s");
          resolve();
        }
      }, 10_000);
    });

    await channel.unsubscribe();

    if (error) {
      console.log("\n❌ Realtime verification FAILED");
      console.log("   This could mean:");
      console.log("   1. Realtime is not enabled in Supabase");
      console.log("   2. Network connectivity issues");
      console.log("   3. Invalid credentials");
      process.exit(1);
    }
  } catch (err) {
    console.error("   ❌ Failed to test Realtime:", err);
    process.exit(1);
  }

  console.log("\n✅ Realtime verification complete");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

