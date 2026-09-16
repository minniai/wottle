import { mergeNewFreezesOntoFresh } from "@/lib/match/frozenTileMerge";
import { logPlaytestInfo } from "@/lib/observability/log";
import type { getServiceRoleClient } from "@/lib/supabase/server";
import type { FrozenTileMap } from "@/lib/types/match";

type Supabase = ReturnType<typeof getServiceRoleClient>;

const CAS_FUNCTION = "update_frozen_tiles_if_unchanged";

/**
 * Persist `matches.frozen_tiles` through the database's compare-and-set
 * function (FR-027, spec 047 FR-005). The UPDATE succeeds only while the stored
 * map still equals `previousFrozenTiles`; a stale baseline is retried once onto
 * the freshly read map with only this round's new freezes layered on.
 *
 * There is deliberately no plain-update fallback. Until spec 047 the function
 * had no migration, so every write took the fallback and a stale baseline
 * erased earlier rounds' freezes (review S5). A missing function now throws,
 * and `pnpm supabase:verify` probes for it.
 */
export async function persistFrozenTilesAtomically(
  supabase: Supabase,
  matchId: string,
  newFrozenTiles: FrozenTileMap,
  previousFrozenTiles: FrozenTileMap,
): Promise<void> {
  const rows = await compareAndSet(supabase, matchId, newFrozenTiles, previousFrozenTiles);
  if (rows > 0) return;
  await retryWithFreshBaseline(supabase, matchId, newFrozenTiles, previousFrozenTiles);
}

async function compareAndSet(
  supabase: Supabase,
  matchId: string,
  next: FrozenTileMap,
  previous: FrozenTileMap,
): Promise<number> {
  const { data, error } = await supabase.rpc(CAS_FUNCTION, {
    p_match_id: matchId,
    p_new_frozen_tiles: next,
    p_previous_frozen_tiles: previous,
  });
  if (error) {
    throw new Error(`Failed to persist frozen tiles atomically (${CAS_FUNCTION}): ${error.message}`);
  }
  return typeof data === "number" ? data : 0;
}

async function retryWithFreshBaseline(
  supabase: Supabase,
  matchId: string,
  computed: FrozenTileMap,
  baseline: FrozenTileMap,
): Promise<void> {
  logPlaytestInfo("frozen-tiles.stale-retry", {
    matchId,
    metadata: { reason: "Stale frozen_tiles, retrying onto the fresh map" },
  });
  const fresh = await loadFrozenTiles(supabase, matchId);
  const merged = mergeNewFreezesOntoFresh(fresh, baseline, computed);
  const rows = await compareAndSet(supabase, matchId, merged, fresh);
  if (rows === 0) {
    throw new Error(`Failed to persist frozen tiles for ${matchId}: baseline changed twice`);
  }
}

/** The match's current freeze map, `{}` when the column is null. */
export async function loadFrozenTiles(supabase: Supabase, matchId: string): Promise<FrozenTileMap> {
  const { data, error } = await supabase.from("matches").select("frozen_tiles").eq("id", matchId).single();
  if (error) throw new Error(`Failed to reload frozen tiles: ${error.message}`);
  const map = (data as { frozen_tiles?: unknown } | null)?.frozen_tiles;
  return map && typeof map === "object" ? (map as FrozenTileMap) : {};
}
