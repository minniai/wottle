import type { BoardGrid, BoardWord } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { BOARD_SIZE } from "@/lib/constants/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";
import {
  calculateLetterPoints,
  calculateLengthBonus,
} from "./scorer";

/**
 * Check whether a word creates an invalid perpendicular cross-word
 * with established tiles (frozen tiles + extra scored tiles).
 *
 * For each tile in the word, the perpendicular direction is traced
 * through neighboring established positions. If the resulting
 * cross-sequence (established + tile) is >= 2 chars and not in
 * the dictionary, the word has a violation.
 */
export function hasCrossWordViolation(
  board: BoardGrid,
  word: BoardWord,
  frozenTileSet: Set<string>,
  dictionary: Set<string>,
  extraTileSet: Set<string> = new Set(),
): boolean {
  const { minimumWordLength } = DEFAULT_GAME_CONFIG;
  const isHorizontal =
    word.direction === "right" || word.direction === "left";
  const dx = isHorizontal ? 0 : 1;
  const dy = isHorizontal ? 1 : 0;

  const isEstablished = (x: number, y: number) =>
    frozenTileSet.has(`${x},${y}`) || extraTileSet.has(`${x},${y}`);

  for (const tile of word.tiles) {
    const tileKey = `${tile.x},${tile.y}`;

    // Skip tiles that are already frozen — their perpendicular
    // cross-words are pre-existing and unaffected by the new word.
    // Only check if a new extra tile creates a new adjacency.
    if (frozenTileSet.has(tileKey)) {
      const hasExtraNeighbor =
        extraTileSet.has(`${tile.x + dx},${tile.y + dy}`) ||
        extraTileSet.has(`${tile.x - dx},${tile.y - dy}`);
      if (!hasExtraNeighbor) continue;
    }

    const beforeChars: string[] = [];
    let bx = tile.x - dx;
    let by = tile.y - dy;
    while (
      bx >= 0 && bx < BOARD_SIZE &&
      by >= 0 && by < BOARD_SIZE &&
      isEstablished(bx, by)
    ) {
      beforeChars.unshift(board[by][bx]);
      bx -= dx;
      by -= dy;
    }

    const afterChars: string[] = [];
    let fx = tile.x + dx;
    let fy = tile.y + dy;
    while (
      fx >= 0 && fx < BOARD_SIZE &&
      fy >= 0 && fy < BOARD_SIZE &&
      isEstablished(fx, fy)
    ) {
      afterChars.push(board[fy][fx]);
      fx += dx;
      fy += dy;
    }

    const crossLength = beforeChars.length + 1 + afterChars.length;
    if (crossLength > 1) {
      const crossWord = [
        ...beforeChars,
        board[tile.y][tile.x],
        ...afterChars,
      ]
        .join("")
        .normalize("NFC")
        .toLowerCase();
      const crossWordReversed = [...crossWord].reverse().join("");
      if (
        !dictionary.has(crossWord) &&
        !dictionary.has(crossWordReversed)
      ) {
        return true;
      }
      if (crossLength < minimumWordLength) return true;
    }
  }

  return false;
}

/**
 * Calculate total score for a word (letter points + length bonus).
 */
function scoreWord(word: BoardWord): number {
  return calculateLetterPoints(word.text) + calculateLengthBonus(word.length);
}

/**
 * Select the highest-scoring subset of candidate words that satisfies
 * the global cross-validation invariant (FR-014, FR-014a).
 *
 * Algorithm:
 * 1. Filter candidates that fail cross-validation against frozen tiles alone
 * 2. Generate all subsets of remaining candidates
 * 3. For each subset, verify mutual cross-validation consistency
 * 4. Return the subset with the maximum total score
 */
export function selectOptimalCombination(
  candidates: BoardWord[],
  board: BoardGrid,
  frozenTiles: FrozenTileMap,
  dictionary: Set<string>,
  playerSlot: "player_a" | "player_b",
): BoardWord[] {
  if (candidates.length === 0) return [];

  const frozenTileSet = new Set(Object.keys(frozenTiles));

  // Step 1: Filter candidates that fail cross-validation against
  // frozen tiles alone (no other candidates considered)
  const viable = candidates.filter(
    (word) =>
      !hasCrossWordViolation(
        board,
        word,
        frozenTileSet,
        dictionary,
      ),
  );

  if (viable.length === 0) return [];

  // Step 2: Generate all non-empty subsets and find the best valid one
  let bestSubset: BoardWord[] = [];
  let bestScore = -1;

  const n = viable.length;
  // Brute-force: enumerate all 2^n - 1 non-empty subsets
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset: BoardWord[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        subset.push(viable[i]);
      }
    }

    // Step 3: Verify mutual cross-validation within the subset
    if (isSubsetValid(subset, board, frozenTileSet, dictionary)) {
      const totalScore = subset.reduce(
        (sum, word) => sum + scoreWord(word),
        0,
      );
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSubset = subset;
      }
    }
  }

  return bestSubset;
}

/**
 * Check that all words in a subset mutually satisfy cross-validation.
 *
 * Each word is checked against frozen tiles PLUS the tiles of all
 * other words in the subset as "extra established" tiles.
 */
function isSubsetValid(
  subset: BoardWord[],
  board: BoardGrid,
  frozenTileSet: Set<string>,
  dictionary: Set<string>,
): boolean {
  for (let i = 0; i < subset.length; i++) {
    // Build extra tile set from all OTHER words in the subset
    const extraTiles = new Set<string>();
    for (let j = 0; j < subset.length; j++) {
      if (i === j) continue;
      for (const tile of subset[j].tiles) {
        extraTiles.add(`${tile.x},${tile.y}`);
      }
    }

    if (
      hasCrossWordViolation(
        board,
        subset[i],
        frozenTileSet,
        dictionary,
        extraTiles,
      )
    ) {
      return false;
    }
  }
  return true;
}
