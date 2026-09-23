import "server-only";

import { z } from "zod";

import { pokeLobby, pokePlayers } from "@/lib/realtime/pokes";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * The lobby's part of the 30s sweep (spec 070 US6, T041): players with tabs but
 * none fresh are gone, so their searches stop and their challenges end as
 * `left`; each side is poked; tab rows stale for ten minutes are pruned.
 * Challenge expiry joins this step with US3.
 */
const PRUNE_AFTER_MS = 10 * 60_000;

const goneRowSchema = z.object({ player_id: z.string().uuid(), counterpart_id: z.string().uuid().nullable() });

export interface LobbySweep {
  gone: string[];
  pruned: number;
}

export async function sweepLobby(): Promise<LobbySweep> {
  const client = getServiceRoleClient();
  const { data, error } = await client.rpc("settle_gone_players");
  if (error) throw new Error(`settle_gone_players: ${error.message}`);
  const rows = z.array(goneRowSchema).parse(data ?? []);
  const gone = [...new Set(rows.map((r) => r.player_id))];
  const counterparts = rows.map((r) => r.counterpart_id).filter((id): id is string => Boolean(id));
  if (gone.length > 0) {
    console.log(JSON.stringify({ event: "presence.gone", count: gone.length }));
    await Promise.all([pokePlayers([...gone, ...counterparts], "outcome"), pokeLobby("is"), pokeLobby("en")]);
  }
  const cutoff = new Date(Date.now() - PRUNE_AFTER_MS).toISOString();
  const pruned = await client.from("presence_tabs").delete({ count: "exact" }).lt("beat_at", cutoff);
  return { gone, pruned: pruned.count ?? 0 };
}
