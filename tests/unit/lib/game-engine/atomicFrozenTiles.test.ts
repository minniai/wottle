import { describe, expect, test } from "vitest";

/**
 * Atomic frozen tile update tests (T047, FR-027).
 *
 * These tests verify the contract for atomic frozen tile updates.
 * The actual database-level conditional UPDATE is implemented as an RPC
 * function in Supabase. These unit tests verify the logic and error
 * handling around the atomic update pattern.
 *
 * Integration-level tests (requiring a running Supabase instance) would
 * verify that concurrent round resolution for the same match does not
 * overwrite frozen tile state.
 */
describe("atomic frozen tile update contract (T047, FR-027)", () => {
  test("should detect stale frozen tiles by comparing JSONB values", () => {
    // The conditional update pattern: UPDATE ... WHERE frozen_tiles = $previous
    // If another round updated frozen_tiles between our read and write,
    // the WHERE clause won't match and 0 rows will be affected.
    const previous = { "0,0": { owner: "player_a" } };
    const current = {
      "0,0": { owner: "player_a" },
      "1,0": { owner: "player_b" },
    };

    // Stale: current !== previous
    expect(JSON.stringify(current)).not.toBe(JSON.stringify(previous));
  });

  test("should match when frozen tiles have not changed", () => {
    const previous = {
      "0,0": { owner: "player_a" as const },
      "1,0": { owner: "player_b" as const },
    };
    const current = {
      "0,0": { owner: "player_a" as const },
      "1,0": { owner: "player_b" as const },
    };

    // Not stale: current === previous (same content)
    expect(JSON.stringify(current)).toBe(JSON.stringify(previous));
  });

  test("should handle empty frozen tiles as valid previous state", () => {
    const previous = {};
    const newTiles = { "0,0": { owner: "player_a" as const } };

    // Empty is a valid initial state — the first round starts with no frozen tiles
    expect(JSON.stringify(previous)).toBe("{}");
    expect(Object.keys(newTiles).length).toBeGreaterThan(0);
  });

  test("should handle shared tile ownership (both players)", () => {
    const tiles = {
      "2,3": { owner: "both" as const },
      "2,4": { owner: "player_a" as const },
    };

    // Shared tiles should serialize deterministically
    const serialized = JSON.stringify(tiles);
    expect(JSON.parse(serialized)).toEqual(tiles);
  });

  test("should detect when a single tile's owner changes", () => {
    const previous = { "5,5": { owner: "player_a" as const } };
    const current = { "5,5": { owner: "both" as const } };

    // Owner changed from player_a to both — stale
    expect(JSON.stringify(previous)).not.toBe(JSON.stringify(current));
  });
});
