import type {
  BoardGrid,
  BoardWord,
  Coordinate,
} from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { scanBoard } from "./boardScanner";
import { applySwap } from "./board";
import { extractValidCrossWords } from "./word-finder";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

/** A word attributed to a specific player. */
export interface AttributedWord extends BoardWord {
  playerId: string;
}

/** A move accepted after conflict resolution. */
export interface AcceptedMove {
  playerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/**
 * Create a unique identity key for a board word instance.
 * Uses text + direction + start coordinate to distinguish
 * the same word at different positions.
 */
function wordKey(word: BoardWord): string {
  return `${word.text}:${word.direction}:${word.start.x},${word.start.y}`;
}

/**
 * Build a Set of word keys from a ScanResult.
 */
function wordKeySet(words: BoardWord[]): Set<string> {
  return new Set(words.map(wordKey));
}

/**
 * Build a Map from word key to BoardWord for fast lookup.
 */
function wordKeyMap(words: BoardWord[]): Map<string, BoardWord> {
  const map = new Map<string, BoardWord>();
  for (const w of words) {
    map.set(wordKey(w), w);
  }
  return map;
}

/**
 * Check whether a word contains any tile frozen by the opponent.
 */
function containsOpponentFrozenTile(
  word: BoardWord,
  frozenTiles: FrozenTileMap,
  playerSlot: "player_a" | "player_b",
): boolean {
  const opponentSlot =
    playerSlot === "player_a" ? "player_b" : "player_a";

  for (const tile of word.tiles) {
    const key = `${tile.x},${tile.y}`;
    const frozen = frozenTiles[key];
    if (frozen) {
      if (frozen.owner === opponentSlot) {
        return true;
      }
      // "both" means both players own it → valid for both
    }
  }
  return false;
}

/**
 * Detect newly formed words by comparing board states and
 * attribute each new word to the player whose swap created it.
 *
 * Uses the three-scan approach:
 * 1. Scan board_before → baseline words
 * 2. Apply first player's swap → scan → intermediate words
 * 3. board_after (both swaps applied) already provided → scan → final words
 *
 * Attribution:
 * - Player A's words: in intermediate but not in baseline
 * - Player B's words: in final but not in intermediate (and not in baseline)
 *
 * Frozen tile filtering (FR-006a):
 * - Player A's words exclude tiles frozen by Player B
 * - Player B's words exclude tiles frozen by Player A
 */
export function detectNewWords(params: {
  boardBefore: BoardGrid;
  boardAfter: BoardGrid;
  dictionary: Set<string>;
  acceptedMoves: AcceptedMove[];
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
}): AttributedWord[] {
  const {
    boardAfter,
    dictionary,
    acceptedMoves,
    frozenTiles,
    playerAId,
    playerBId,
  } = params;

  // Determine which moves belong to which player
  const playerAMoves = acceptedMoves.filter(
    (m) => m.playerId === playerAId,
  );
  const playerBMoves = acceptedMoves.filter(
    (m) => m.playerId === playerBId,
  );

  const result: AttributedWord[] = [];
  const reportedKeys = new Set<string>();

  if (playerAMoves.length === 0 && playerBMoves.length === 0) {
    return result;
  }

  // Wottle v2 Validation Rule: For each accepted move, we extract orthogonal 
  // words from the `boardAfter` around the swapped tiles.
  
  // Helper to process a player's moves
  const processMoves = (moves: AcceptedMove[], pId: string, playerSlot: "player_a" | "player_b") => {
    for (const move of moves) {
      const extResult = extractValidCrossWords(
        boardAfter,
        { from: { x: move.fromX, y: move.fromY }, to: { x: move.toX, y: move.toY } },
        dictionary,
        DEFAULT_GAME_CONFIG
      );

      // In the game engine pipeline, if a move is invalid (i.e., invalid word formed),
      // we would ideally rollback. But for `detectNewWords` as currently spec'd,
      // we only return valid AttributedWords. If the swap caused an invalid word,
      // it should theoretically be stopped *before* scoring. But here we only extract the valid ones.
      if (extResult.isValid) {
        for (const word of extResult.words) {
          const key = wordKey(word);
          if (reportedKeys.has(key)) continue;

          if (containsOpponentFrozenTile(word, frozenTiles, playerSlot)) {
            continue;
          }

          reportedKeys.add(key);
          result.push({ ...word, playerId: pId });
        }
      }
    }
  };

  processMoves(playerAMoves, playerAId, "player_a");
  processMoves(playerBMoves, playerBId, "player_b");

  return result;
}
