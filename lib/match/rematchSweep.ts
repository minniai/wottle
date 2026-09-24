import "server-only";

import { pokePlayers } from "@/lib/realtime/pokes";
import { getServiceRoleClient } from "@/lib/supabase/server";

import { expireDueRematches, matchPlayers } from "./rematchService";

export interface RematchSweep {
  /** Matches whose pending request ended: ran out, or a player left the match. */
  ended: string[];
}

/** Spec 071 (T036): the 30s sweep ends due rematch requests and pokes both players of each. */
export async function sweepRematches(): Promise<RematchSweep> {
  const client = getServiceRoleClient();
  const ended = await expireDueRematches(client);
  await Promise.all(ended.map(async (matchId) => pokePlayers(await matchPlayers(client, matchId), "rematch")));
  return { ended };
}
