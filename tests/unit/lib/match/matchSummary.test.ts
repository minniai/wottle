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

  it("counts tiles owned by both toward each player", () => {
    const frozenTiles: FrozenTileMap = {
      "5,5": { owner: "both" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    expect(result).toEqual({ playerA: 1, playerB: 1 });
  });

  it("handles mixed ownership correctly", () => {
    const frozenTiles: FrozenTileMap = {
      "0,0": { owner: "player_a" },
      "1,1": { owner: "player_b" },
      "2,2": { owner: "both" },
      "3,3": { owner: "player_a" },
    };
    const result = computeFrozenTileCountByPlayer(frozenTiles);
    // playerA: tiles at (0,0), (2,2), (3,3) = 3
    // playerB: tiles at (1,1), (2,2) = 2
    expect(result).toEqual({ playerA: 3, playerB: 2 });
  });
});
