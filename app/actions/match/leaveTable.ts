"use server";

import "server-only";

import { publishMatchState } from "@/lib/match/statePublisher";
import { leaveTable } from "@/lib/match/tableService";
import { getServiceRoleClient } from "@/lib/supabase/server";

import { guardTableAction, type TableRefusal } from "./tableGuard";

export type LeaveTableResult = { status: "void" | "not_pending" | "not_due" } | TableRefusal;

/** `leave`, or Back from the table or the count (spec 069 FR-019): the table is void, recorded against the leaver. */
export async function leaveTableAction(matchId: string): Promise<LeaveTableResult> {
  const guard = await guardTableAction(matchId);
  if ("status" in guard) return guard;
  return leaveTable({ client: getServiceRoleClient(), publish: publishMatchState }, matchId, guard.playerId);
}
