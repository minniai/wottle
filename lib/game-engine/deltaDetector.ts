import type {
  BoardGrid,
  BoardWord,
  Coordinate,
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
    boardBefore,
    boardAfter,
    dictionary,
    acceptedMoves,
    frozenTiles,
    playerAId,
    playerBId,
  } = params;

  // Scan the baseline board (before any swaps)
  const wordsBefore = scanBoard(boardBefore, dictionary);
  const beforeKeys = wordKeySet(wordsBefore.words);

  // Determine which moves belong to which player
  const playerAMoves = acceptedMoves.filter(
    (m) => m.playerId === playerAId,
  );
  const playerBMoves = acceptedMoves.filter(
    (m) => m.playerId === playerBId,
  );

  const result: AttributedWord[] = [];

  if (playerAMoves.length === 0 && playerBMoves.length === 0) {
    return result;
  }

  // Build intermediate board (after Player A's swap only)
  let intermediateBoard = boardBefore;
  for (const move of playerAMoves) {
    intermediateBoard = applySwap(intermediateBoard, {
      from: { x: move.fromX, y: move.fromY },
      to: { x: move.toX, y: move.toY },
    });
  }

  const wordsAfterA = scanBoard(intermediateBoard, dictionary);
  const afterAKeys = wordKeySet(wordsAfterA.words);
  const afterAMap = wordKeyMap(wordsAfterA.words);

  // Scan the final board (after both swaps)
  const wordsAfterAB = scanBoard(boardAfter, dictionary);
  const afterABMap = wordKeyMap(wordsAfterAB.words);

  // Player A's new words: in afterA but not in before
  for (const [key, word] of afterAMap) {
    if (beforeKeys.has(key)) {
      continue;
    }
    if (
      containsOpponentFrozenTile(word, frozenTiles, "player_a")
    ) {
      continue;
    }
    result.push({ ...word, playerId: playerAId });
  }

  // Player B's new words: in afterAB but not in afterA (and not in before)
  for (const [key, word] of afterABMap) {
    if (beforeKeys.has(key) || afterAKeys.has(key)) {
      continue;
    }
    if (
      containsOpponentFrozenTile(word, frozenTiles, "player_b")
    ) {
      continue;
    }
    result.push({ ...word, playerId: playerBId });
  }

  return result;
}
