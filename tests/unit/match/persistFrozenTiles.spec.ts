import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistFrozenTilesAtomically } from "@/lib/match/frozenTilePersistence";
import type { FrozenTile, FrozenTileMap } from "@/lib/types/match";

/**
 * Spec 047 R1.1 (review S5). `matches.frozen_tiles` is only ever written through
 * the database's compare-and-set function. There is no plain-update fallback:
 * the previous one ran on every round in production, because the function had
 * no migration, and a stale baseline erased earlier rounds' freezes.
 */
const MATCH_ID = "match-1";
const a: FrozenTile = { owner: "player_a" };
const b: FrozenTile = { owner: "player_b" };

function buildClient(rpcResults: Array<{ data: number | null; error: { message: string; code?: string } | null }>, fresh: FrozenTileMap) {
  const rpc = vi.fn();
  for (const result of rpcResults) rpc.mockResolvedValueOnce(result);
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { frozen_tiles: fresh }, error: null }) })),
    })),
    update,
  }));
  return { client: { rpc, from } as never, rpc, update };
}

describe("persistFrozenTilesAtomically", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("writes through the compare-and-set function when the baseline matches", async () => {
    const previous: FrozenTileMap = { "0,0": a };
    const computed: FrozenTileMap = { "0,0": a, "1,1": a };
    const { client, rpc, update } = buildClient([{ data: 1, error: null }], previous);

    await persistFrozenTilesAtomically(client, MATCH_ID, computed, previous);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("update_frozen_tiles_if_unchanged", {
      p_match_id: MATCH_ID,
      p_new_frozen_tiles: computed,
      p_previous_frozen_tiles: previous,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("retries once onto the fresh map when the baseline is stale, keeping concurrent freezes", async () => {
    const previous: FrozenTileMap = { "0,0": a };
    const computed: FrozenTileMap = { "0,0": a, "1,1": a };
    const fresh: FrozenTileMap = { "0,0": a, "2,2": b };
    const { client, rpc, update } = buildClient([{ data: 0, error: null }, { data: 1, error: null }], fresh);

    await persistFrozenTilesAtomically(client, MATCH_ID, computed, previous);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("update_frozen_tiles_if_unchanged", {
      p_match_id: MATCH_ID,
      p_new_frozen_tiles: { "0,0": a, "2,2": b, "1,1": a },
      p_previous_frozen_tiles: fresh,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the retry is stale too — never a blind write", async () => {
    const { client, update } = buildClient([{ data: 0, error: null }, { data: 0, error: null }], {});

    await expect(persistFrozenTilesAtomically(client, MATCH_ID, { "1,1": a }, {})).rejects.toThrow(/baseline changed twice/);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the function is missing instead of falling back to a plain update", async () => {
    const { client, update } = buildClient(
      [{ data: null, error: { message: "Could not find the function public.update_frozen_tiles_if_unchanged", code: "PGRST202" } }],
      {},
    );

    await expect(persistFrozenTilesAtomically(client, MATCH_ID, { "1,1": a }, {})).rejects.toThrow(/update_frozen_tiles_if_unchanged/);
    expect(update).not.toHaveBeenCalled();
  });
});
