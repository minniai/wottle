import { NextResponse } from "next/server";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";

const NO_CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  const startedAt = Date.now();
  let matchIds: string[];
  try {
    matchIds = await findOrphanedMatches();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        event: "sweep_stale_matches.find_failed",
        error: message,
      }),
    );
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  const settled = await Promise.allSettled(
    matchIds.map((id) => completeMatchInternal(id, "abandoned")),
  );

  const swept: string[] = [];
  const failed: Array<{ matchId: string; error: string }> = [];
  settled.forEach((outcome, index) => {
    const matchId = matchIds[index];
    if (outcome.status === "fulfilled") {
      swept.push(matchId);
    } else {
      const reason = outcome.reason;
      failed.push({
        matchId,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });

  console.log(
    JSON.stringify({
      event: "sweep_stale_matches",
      swept_count: swept.length,
      failed_count: failed.length,
      duration_ms: Date.now() - startedAt,
    }),
  );

  return NextResponse.json(
    { swept, failed },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
