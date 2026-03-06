import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Count frozen tiles per player from the match frozen tile map.
 * Each tile has exactly one owner (first-owner-wins semantics).
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
