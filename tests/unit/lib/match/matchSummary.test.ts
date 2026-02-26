import { describe, expect, it } from "vitest";

// T027: These tests will FAIL until lib/match/matchSummary.ts is created
import { computeFrozenTileCountByPlayer } from "@/lib/match/matchSummary";
import type { FrozenTileMap } from "@/lib/types/match";

describe("matchSummary.computeFrozenTileCountByPlayer", () => {
  it("returns zero counts for an empty frozen tile map", () => {
    const result = computeFrozenTileCountByPlayer({});
    expect(result).toEqual({ playerA: 0, playerB: 0 });
  });

  it("counts tiles owned exclusively by player_a", () => {
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_a" },
      "2,2": { owner: "player_a" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    expect(result).toEqual({ playerA: 3, playerB: 0 });
  });

  it("counts tiles owned exclusively by player_b", () => {
    const frozenTiles: FrozenTileMap = {
      "3,3": { owner: "player_b" },
      "4,4": { owner: "player_b" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    expect(result).toEqual({ playerA: 0, playerB: 2 });
  });

  it("T013c: does NOT count 'both' tiles for either player (exclusive ownership)", () => {
    const frozenTiles: FrozenTileMap = {
      "5,5": { owner: "both" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    // "both" tiles are excluded from tiebreaker counts for both players
    expect(result).toEqual({ playerA: 0, playerB: 0 });
  });

  it("T013d: handles mixed ownership — 'both' tiles excluded, exclusive tiles counted", () => {
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_b" },
      "2,2": { owner: "both" },
      "3,3": { owner: "player_a" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    // playerA: (0,0), (3,3) = 2  (excluding "both" at (2,2))
    // playerB: (1,1) = 1  (excluding "both" at (2,2))
    expect(result).toEqual({ playerA: 2, playerB: 1 });
  });
});
