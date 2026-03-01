import type { WordScore } from "@/lib/types/match";
import {
  PLAYER_A_HIGHLIGHT,
  PLAYER_B_HIGHLIGHT,
} from "@/lib/constants/playerColors";

/**
 * Derives a per-tile color map from scored words.
 * Keys are "x,y" strings; values are CSS color strings.
 * Player A tiles get PLAYER_A_HIGHLIGHT; all others get PLAYER_B_HIGHLIGHT.
 */
export function deriveHighlightPlayerColors(
  words: WordScore[],
  playerAId: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const word of words) {
    const color = word.playerId === playerAId ? PLAYER_A_HIGHLIGHT : PLAYER_B_HIGHLIGHT;
    for (const coord of word.coordinates) {
      map[`${coord.x},${coord.y}`] = color;
    }
  }
  return map;
}
