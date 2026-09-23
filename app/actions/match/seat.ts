"use server";

import "server-only";

import { publishMatchState } from "@/lib/match/statePublisher";
import { seatPlayer } from "@/lib/match/tableService";
import { getServiceRoleClient } from "@/lib/supabase/server";

import { guardTableAction, type TableRefusal } from "./tableGuard";

export type SeatResult = { status: "seated" | "started" | "void" | "ended" | "not_found" } | TableRefusal;

/** `ready ▸` (spec 069 FR-004): sit down; the second seat starts the match. */
export async function seatAction(matchId: string): Promise<SeatResult> {
  const guard = await guardTableAction(matchId);
  if ("status" in guard) return guard;
  const outcome = await seatPlayer({ client: getServiceRoleClient(), publish: publishMatchState }, matchId, guard.playerId);
  return { status: outcome.status };
}
