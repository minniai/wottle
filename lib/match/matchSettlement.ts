import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { getServiceRoleClient } from "@/lib/supabase/server";

import { findDueMatches } from "./findDueMatches";
import { resolvePendingMoves } from "./moveResolver";

export type SettlementOutcome = "completed" | "not_due" | "already";

interface SettlementRow {
  state: string;
  player_a_moves: number;
  player_b_moves: number;
  move_limit: number;
}

/**
 * Settle a match once it is due (spec 050, contracts/settlement.md): drain
 * every move received before the deadline first, then complete under the
 * natural rules when both players have the move limit or the database says
 * the deadline has passed. Completion is a compare-and-set, so the resolver,
 * a state poll and the cron sweep may all call this and the ratings are
 * applied once.
 */
export async function settleMatchIfDue(matchId: string): Promise<SettlementOutcome> {
  const drained = await resolvePendingMoves(matchId);
  const row = await readSettlementRow(matchId);
  if (!row) return "already";
  if (row.state === "completed" || row.state === "abandoned") return "already";
  if (row.state !== "in_progress") return "not_due";
  const bothDone =
    drained.bothDone || (row.player_a_moves >= row.move_limit && row.player_b_moves >= row.move_limit);
  if (!bothDone && !(await isPastDeadline(matchId))) return "not_due";
  const result = await completeMatchInternal(matchId, "natural");
  return result.endedReason === "abandoned" ? "already" : "completed";
}

async function readSettlementRow(matchId: string): Promise<SettlementRow | null> {
  const { data } = await getServiceRoleClient()
    .from("matches")
    .select("state,player_a_moves,player_b_moves,move_limit")
    .eq("id", matchId)
    .maybeSingle();
  return (data as SettlementRow | null) ?? null;
}

async function isPastDeadline(matchId: string): Promise<boolean> {
  const due = await findDueMatches();
  return due.includes(matchId);
}
