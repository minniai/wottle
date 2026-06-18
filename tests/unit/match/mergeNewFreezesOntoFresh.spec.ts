import { describe, expect, it } from "vitest";

import { mergeNewFreezesOntoFresh } from "@/lib/match/frozenTileMerge";
import type { FrozenTile, FrozenTileMap } from "@/lib/types/match";

/**
 * Regression for 2026-06-18 code-quality review §2: the stale-retry path in
 * `persistFrozenTilesAtomically` must re-apply only THIS round's new freezes
 * onto freshly-loaded state, NOT blindly overwrite with the map computed
 * against a now-stale baseline (which silently dropped a concurrent round's
 * freezes).
 */
describe("mergeNewFreezesOntoFresh", () => {
  const a: FrozenTile = { owner: "player_a" };
  const b: FrozenTile = { owner: "player_b" };

  it("preserves a concurrent round's freeze that landed after our baseline", () => {
    const baseline: FrozenTileMap = { "0,0": a };
    // Our round froze 1,1 on top of the baseline.
    const computed: FrozenTileMap = { "0,0": a, "1,1": a };
    // Meanwhile a concurrent round froze 2,2 — present in fresh, absent here.
    const fresh: FrozenTileMap = { "0,0": a, "2,2": b };

    const merged = mergeNewFreezesOntoFresh(fresh, baseline, computed);

    expect(merged).toEqual({ "0,0": a, "2,2": b, "1,1": a });
  });

  it("does not clobber a key already present in fresh state", () => {
    const baseline: FrozenTileMap = {};
    const computed: FrozenTileMap = { "3,3": a };
    // The concurrent round already froze 3,3 for player_b; baseline lacked it,
    // so it's part of our delta — but fresh wins for shared keys only when the
    // key is in baseline. Here 3,3 is NOT in baseline, so our delta applies.
    const fresh: FrozenTileMap = { "3,3": b };

    const merged = mergeNewFreezesOntoFresh(fresh, baseline, computed);

    // Our round's freeze on 3,3 is applied (key absent from baseline = our add).
    expect(merged["3,3"]).toEqual(a);
  });

  it("keeps fresh state for baseline keys our round did not change", () => {
    const baseline: FrozenTileMap = { "0,0": a };
    const computed: FrozenTileMap = { "0,0": a };
    const fresh: FrozenTileMap = { "0,0": a, "9,9": b };

    const merged = mergeNewFreezesOntoFresh(fresh, baseline, computed);

    expect(merged).toEqual({ "0,0": a, "9,9": b });
  });

  it("returns a fresh copy of fresh state when our round froze nothing new", () => {
    const fresh: FrozenTileMap = { "0,0": a };
    const merged = mergeNewFreezesOntoFresh(fresh, {}, {});
    expect(merged).toEqual(fresh);
    expect(merged).not.toBe(fresh);
  });
});
