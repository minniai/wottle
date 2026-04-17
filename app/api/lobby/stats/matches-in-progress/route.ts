import { NextResponse } from "next/server";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LobbyMatchesStats } from "@/lib/types/match";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

export async function GET() {
  try {
    const supabase = getServiceRoleClient();
    const { count, error } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (error) {
      console.error("Failed to count matches-in-progress", error);
      return NextResponse.json(
        { error: "matches_count_failed" },
        { status: 500, headers: NO_CACHE_HEADERS },
      );
    }

    const body: LobbyMatchesStats = { matchesInProgress: count ?? 0 };
    return NextResponse.json(body, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("matches-in-progress route failed", error);
    return NextResponse.json(
      { error: "matches_count_failed" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
