import { NextResponse } from "next/server";

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findDueMatches } from "@/lib/match/findDueMatches";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";
import { findDueTables } from "@/lib/match/findDueTables";
import { settleMatchIfDue } from "@/lib/match/matchSettlement";
import { publishMatchState } from "@/lib/match/statePublisher";
import { voidDueTable } from "@/lib/match/tableService";
import { getServiceRoleClient } from "@/lib/supabase/server";

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
 * Three sweeps every 30s (pg_cron → this route): orphaned matches (both players
 * gone) are abandoned, unrated (spec 050 FR-011a); matches past their deadline
 * are settled under the normal rules (contracts/settlement.md); tables whose
 * time to sit down has run out are void (spec 069 FR-015). Each goes through
 * its own compare-and-set, so whichever runs first wins.
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
  let tableIds: string[];
  try {
    [orphanIds, dueIds, tableIds] = await Promise.all([findOrphanedMatches(), findDueMatches(), findDueTables()]);
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
  const tableDeps = { client: getServiceRoleClient(), publish: publishMatchState };
  const tables = partition(tableIds, await Promise.allSettled(tableIds.map((id) => voidDueTable(tableDeps, id))));

  console.log(
    JSON.stringify({
      event: "sweep_stale_matches",
      swept_count: orphans.done.length,
      failed_count: orphans.failed.length,
      settled_count: due.done.length,
      settle_failed_count: due.failed.length,
      voided_count: tables.done.length,
      void_failed_count: tables.failed.length,
      duration_ms: Date.now() - startedAt,
    }),
  );

  return NextResponse.json(
    { swept: orphans.done, failed: orphans.failed, settled: due.done, settleFailed: due.failed, voided: tables.done, voidFailed: tables.failed },
    { status: 200, headers: NO_CACHE_HEADERS },
  );
}
