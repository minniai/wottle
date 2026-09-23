import { NextResponse } from "next/server";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LobbyMatchesStats } from "@/lib/types/match";

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
};

/** Matches in progress, in one lobby's language when `?language=` names it (spec 070 S10). */
export async function GET(request?: Request) {
  try {
    const language = request ? new URL(request.url).searchParams.get("language") : null;
    const supabase = getServiceRoleClient();
    let query = supabase.from("matches").select("id", { count: "exact", head: true }).eq("state", "in_progress");
    if (language === "is" || language === "en") query = query.eq("language", language);
    const { count, error } = await query;

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
