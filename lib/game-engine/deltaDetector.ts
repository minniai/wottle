import type {
  BoardGrid,
  BoardWord,
} from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { scanBoard } from "./boardScanner";
import { applySwap } from "./board";

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
 *
 * Direction filtering: only "right" and "down" words are scored (no diagonals).
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
    boardBefore,
    boardAfter,
    dictionary,
    acceptedMoves,
    frozenTiles,
    playerAId,
    playerBId,
  } = params;

  const playerAMoves = acceptedMoves.filter((m) => m.playerId === playerAId);
  const playerBMoves = acceptedMoves.filter((m) => m.playerId === playerBId);

  const result: AttributedWord[] = [];
  const reportedKeys = new Set<string>();

  if (playerAMoves.length === 0 && playerBMoves.length === 0) {
    return result;
  }

  // 1. Scan boardBefore (baseline)
  const baseline = scanBoard(boardBefore, dictionary);
  const baselineKeys = wordKeySet(baseline.words);

  // 2. Scan after Player A's moves (intermediate)
  let boardA = boardBefore;
  for (const move of playerAMoves) {
    boardA = applySwap(boardA, {
      from: { x: move.fromX, y: move.fromY },
      to: { x: move.toX, y: move.toY },
    });
  }
  const intermediate = scanBoard(boardA, dictionary);
  const intermediateKeys = wordKeySet(intermediate.words);

  // 3. Scan final board (already boardAfter)
  const final = scanBoard(boardAfter, dictionary);

  // Helper to filter and attribute words
  const filterAndAttribute = (
    words: BoardWord[],
    excludeKeys: Set<string>,
    pId: string,
    playerSlot: "player_a" | "player_b",
  ) => {
    for (const word of words) {
      // Only horizontal/vertical (no diagonals)
      if (word.direction !== "right" && word.direction !== "down") continue;

      const key = wordKey(word);
      if (excludeKeys.has(key)) continue;
      if (reportedKeys.has(key)) continue;

      if (containsOpponentFrozenTile(word, frozenTiles, playerSlot)) continue;

      reportedKeys.add(key);
      result.push({ ...word, playerId: pId });
    }
  };

  // Player A gets words that appeared in intermediate but weren't in baseline
  filterAndAttribute(intermediate.words, baselineKeys, playerAId, "player_a");

  // Player B gets words that appeared in final but weren't in intermediate
  filterAndAttribute(final.words, intermediateKeys, playerBId, "player_b");

  return result;
}
