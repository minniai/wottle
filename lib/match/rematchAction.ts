import "server-only";

import { z } from "zod";

import { REMATCH_RATE_LIMIT } from "@/lib/constants/rematch";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { pokePlayers } from "@/lib/realtime/pokes";
import { getServiceRoleClient } from "@/lib/supabase/server";

import { matchPlayers } from "./rematchService";

const matchIdSchema = z.string().uuid("Invalid match ID.");

export interface RematchCaller {
  playerId: string;
  client: ReturnType<typeof getServiceRoleClient>;
}

/** Every rematch action: a match id, a session, the shared `match:rematch` limit (spec 071). */
export async function rematchCaller(matchId: string): Promise<RematchCaller> {
  matchIdSchema.parse(matchId);
  const session = await readLobbySession();
  if (!session) throw new Error("Authentication required.");
  assertWithinRateLimit({ identifier: session.player.id, ...REMATCH_RATE_LIMIT });
  return { playerId: session.player.id, client: getServiceRoleClient() };
}

/** Pokes carry no payload (spec 070): both players re-read the old match's state. */
export async function pokeBoth(caller: RematchCaller, matchId: string): Promise<void> {
  await pokePlayers(await matchPlayers(caller.client, matchId), "rematch");
}
