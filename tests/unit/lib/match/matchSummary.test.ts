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

  it("T013c: counts all tiles — each has exactly one owner (first-owner-wins)", () => {
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_b" },
      "3,3": { owner: "player_a" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    // First-owner-wins: playerA: (0,0), (3,3) = 2; playerB: (1,1) = 1
    expect(result).toEqual({ playerA: 2, playerB: 1 });
  });
});
