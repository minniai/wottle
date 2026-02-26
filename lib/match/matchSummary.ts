import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Count exclusively-owned frozen tiles per player from the match frozen tile map.
 * Tiles with owner "both" are excluded from both counts (tiebreaker uses exclusive ownership).
 */
export function computeFrozenTileCountByPlayer(
  frozenTiles: FrozenTileMap,
): { playerA: number; playerB: number } {
  let playerA = 0;
  let playerB = 0;
  for (const tile of Object.values(frozenTiles)) {
    if (tile.owner === "player_a") playerA++;
    if (tile.owner === "player_b") playerB++;
  }
  return { playerA, playerB };
}
