import type { WordHistoryRow } from "@/components/match/FinalSummary";
import type { FrozenTileMap } from "@/lib/types/match";
import {
  PLAYER_A_HOVER_HIGHLIGHT,
  PLAYER_B_HOVER_HIGHLIGHT,
} from "@/lib/constants/playerColors";

/**
 * Derives the per-tile highlight color map for a hover in the post-game
 * Round History panel.
 *
 * For each coord in the hovered words, the colour is chosen from the *frozen
 * tile owner* — not the word's author — so a word that crosses tiles owned
 * by both players highlights each tile in its own colour. Falls back to the
 * word author when the tile is not frozen (rare in post-game state).
 */
export function derivePostGameHighlightColors(
  words: WordHistoryRow[],
  frozenTiles: FrozenTileMap,
  playerAId: string,
): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const word of words) {
    const wordAuthorColor =
      word.playerId === playerAId
        ? PLAYER_A_HOVER_HIGHLIGHT
        : PLAYER_B_HOVER_HIGHLIGHT;
    for (const coord of word.coordinates) {
      const key = `${coord.x},${coord.y}`;
      const frozenOwner = frozenTiles[key]?.owner;
      const color = frozenOwner
        ? frozenOwner === "player_a"
          ? PLAYER_A_HOVER_HIGHLIGHT
          : PLAYER_B_HOVER_HIGHLIGHT
        : wordAuthorColor;
      colors[key] = color;
    }
  }
  return colors;
}
