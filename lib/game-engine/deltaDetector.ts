import type {
  BoardGrid,
  BoardWord,
} from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { scanBoard } from "./boardScanner";
import { applySwap } from "./board";
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
 * Build a Set of "x,y" position keys for all tiles that belong to any of the given words.
 */
function buildTileSet(words: BoardWord[]): Set<string> {
  const set = new Set<string>();
  for (const word of words) {
    for (const tile of word.tiles) {
      set.add(`${tile.x},${tile.y}`);
    }
  }
  return set;
}

/**
 * Check whether a word creates an invalid perpendicular cross-word with any
 * previously recognised words on the board.
 *
 * For each tile T in `word`, the perpendicular direction is traced through
 * neighbouring positions that belong to `existingTileSet` (tiles from words
 * that existed *before* this word appeared). Only those neighbour tiles — not
 * the full 10-tile row/column — form the cross-word candidate.
 *
 * If the candidate cross-word (existing-word-tiles + T) is longer than one
 * tile and is not in the dictionary, the word has a violation.
 *
 * This bounds the cross-word to word-to-word junctions, which is the correct
 * Scrabble-style semantics on a dense board.
 */
function hasCrossWordViolation(
  board: BoardGrid,
  word: BoardWord,
  existingTileSet: Set<string>,
  dictionary: Set<string>,
): boolean {
  const { boardSize, minimumWordLength } = DEFAULT_GAME_CONFIG;
  const isHorizontal = word.direction === "right";
  // Perpendicular direction: vertical for horizontal words, horizontal for vertical words
  const dx = isHorizontal ? 0 : 1;
  const dy = isHorizontal ? 1 : 0;

  for (const tile of word.tiles) {
    // Trace backward (upward for horizontal words)
    const beforeChars: string[] = [];
    let bx = tile.x - dx;
    let by = tile.y - dy;
    while (
      bx >= 0 && bx < boardSize &&
      by >= 0 && by < boardSize &&
      existingTileSet.has(`${bx},${by}`)
    ) {
      beforeChars.unshift(board[by][bx]);
      bx -= dx;
      by -= dy;
    }

    // Trace forward (downward for horizontal words)
    const afterChars: string[] = [];
    let fx = tile.x + dx;
    let fy = tile.y + dy;
    while (
      fx >= 0 && fx < boardSize &&
      fy >= 0 && fy < boardSize &&
      existingTileSet.has(`${fx},${fy}`)
    ) {
      afterChars.push(board[fy][fx]);
      fx += dx;
      fy += dy;
    }

    const crossLength = beforeChars.length + 1 + afterChars.length;
    if (crossLength > 1) {
      const crossWord = [...beforeChars, board[tile.y][tile.x], ...afterChars]
        .join("")
        .normalize("NFC")
        .toLowerCase();
      if (!dictionary.has(crossWord)) return true;
      if (crossLength < minimumWordLength) return true;
    }
  }

  return false;
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
 * Cross-word validation (009):
 * - Only "right" and "down" words are scored (no diagonals).
 * - A new word is only scored if none of its tiles form an invalid
 *   perpendicular sequence with tiles from previously recognised words.
 *   The cross-word is bounded to word-to-word junctions (not the full column/row).
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

  // Helper to filter, cross-word-validate, and attribute words.
  // `board` is the board state at the point the words were found.
  // `existingWords` are the recognised words that existed BEFORE this player's
  // swap — used to bound the perpendicular cross-word check.
  const filterAndAttribute = (
    words: BoardWord[],
    excludeKeys: Set<string>,
    pId: string,
    playerSlot: "player_a" | "player_b",
    board: BoardGrid,
    existingWords: BoardWord[],
  ) => {
    const existingTileSet = buildTileSet(existingWords);

    for (const word of words) {
      // Only horizontal/vertical (no diagonals)
      if (word.direction !== "right" && word.direction !== "down") continue;

      const key = wordKey(word);
      if (excludeKeys.has(key)) continue;
      if (reportedKeys.has(key)) continue;

      if (containsOpponentFrozenTile(word, frozenTiles, playerSlot)) continue;

      // Cross-word check: reject if any tile creates an invalid junction
      // with a tile from a previously recognised word.
      if (hasCrossWordViolation(board, word, existingTileSet, dictionary)) continue;

      reportedKeys.add(key);
      result.push({ ...word, playerId: pId });
    }
  };

  // Player A: new words checked against baseline (pre-swap) word tiles
  filterAndAttribute(intermediate.words, baselineKeys, playerAId, "player_a", boardA, baseline.words);

  // Player B: new words checked against intermediate (post-A-swap) word tiles
  filterAndAttribute(final.words, intermediateKeys, playerBId, "player_b", boardAfter, intermediate.words);

  return result;
}
