import { NextResponse } from "next/server";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findDueMatches } from "@/lib/match/findDueMatches";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";
import { settleMatchIfDue } from "@/lib/match/matchSettlement";

const NO_CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

interface Failure {
  matchId: string;
  error: string;
}

function partition<T>(ids: string[], settled: PromiseSettledResult<T>[]): { done: string[]; failed: Failure[] } {
  const done: string[] = [];
  const failed: Failure[] = [];
  settled.forEach((outcome, index) => {
    const matchId = ids[index];
    if (outcome.status === "fulfilled") {
      done.push(matchId);
    } else {
      const reason = outcome.reason;
      failed.push({ matchId, error: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return { done, failed };
}

/**
 * Two sweeps every 30s (pg_cron → this route): orphaned matches (both players
 * gone) are abandoned, unrated (spec 050 FR-011a); matches past their deadline
 * are settled under the normal rules (contracts/settlement.md). Both go through
 * the completion compare-and-set, so whichever runs first wins.
 */
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
  let orphanIds: string[];
  let dueIds: string[];
  try {
    [orphanIds, dueIds] = await Promise.all([findOrphanedMatches(), findDueMatches()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(JSON.stringify({ event: "sweep_stale_matches.find_failed", error: message }));
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }

  const orphans = partition(
    orphanIds,
    await Promise.allSettled(orphanIds.map((id) => completeMatchInternal(id, "abandoned"))),
  );
  const due = partition(dueIds, await Promise.allSettled(dueIds.map((id) => settleMatchIfDue(id))));

  console.log(
    JSON.stringify({
      event: "sweep_stale_matches",
      swept_count: orphans.done.length,
      failed_count: orphans.failed.length,
      settled_count: due.done.length,
      settle_failed_count: due.failed.length,
      duration_ms: Date.now() - startedAt,
    }),
  );

  return NextResponse.json(
    { swept: orphans.done, failed: orphans.failed, settled: due.done, settleFailed: due.failed },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
