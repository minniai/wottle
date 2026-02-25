import type { FrozenTileMap } from "@/lib/types/match";

/**
 * Count frozen tiles attributed to each player from the match frozen tile map.
 * Tiles with owner "both" count toward both players.
 */
export function computeFrozenTileCountByPlayer(
  frozenTiles: FrozenTileMap,
): { playerA: number; playerB: number } {
  let playerA = 0;
  let playerB = 0;
  for (const tile of Object.values(frozenTiles)) {
    if (tile.owner === "player_a" || tile.owner === "both") playerA++;
    if (tile.owner === "player_b" || tile.owner === "both") playerB++;
  }
  return { playerA, playerB };
}
