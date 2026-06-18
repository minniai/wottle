import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Re-apply only THIS round's new freezes on top of freshly-loaded state.
 *
 * `computed` is `fresh-at-compute-time ∪ this-round`. The keys this round added
 * are those in `computed` but not in `baseline` (freezes are monotonic — a tile
 * never un-freezes mid-match). Layering just that delta onto the freshly-loaded
 * `fresh` map preserves a concurrent round's freezes instead of clobbering them.
 *
 * Used by `persistFrozenTilesAtomically`'s stale-retry path. Lives in `lib`
 * (not the `"use server"` action module) because it is a pure synchronous
 * helper — `"use server"` files may only export async Server Actions.
 */
export function mergeNewFreezesOntoFresh(
  fresh: FrozenTileMap,
  baseline: FrozenTileMap,
  computed: FrozenTileMap,
): FrozenTileMap {
  const merged: FrozenTileMap = { ...fresh };
  for (const [key, tile] of Object.entries(computed)) {
    if (!(key in baseline)) {
      merged[key] = tile;
    }
  }
  return merged;
}
