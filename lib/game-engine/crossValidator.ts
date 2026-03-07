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
    if (crossLength >= minimumWordLength) {
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
      ) &&
      !violatesFrozenAdjacencyOnSameAxis(
        word,
        board,
        frozenTileSet,
        dictionary,
      ) &&
      !violatesSameAxisBoundary(word, board, dictionary),
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

    // Step 3a: Skip subsets with same-axis overlap or adjacency
    if (!hasNoSameAxisConflict(subset)) continue;

    // Step 3b: Verify mutual cross-validation within the subset
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
 * Check whether a candidate word is adjacent to a frozen scored word
 * on the same axis and the combined sequence is NOT a valid word.
 *
 * Only triggers when the adjacent frozen run is itself a valid
 * dictionary word (i.e., it was scored on this axis). Frozen tiles
 * from perpendicular words that happen to be adjacent are ignored.
 */
function violatesFrozenAdjacencyOnSameAxis(
  word: BoardWord,
  board: BoardGrid,
  frozenTileSet: Set<string>,
  dictionary: Set<string>,
): boolean {
  const isHorizontal =
    word.direction === "right" || word.direction === "left";
  const dx = isHorizontal ? 1 : 0;
  const dy = isHorizontal ? 0 : 1;

  // Get axis-sorted tiles
  const sortedTiles = [...word.tiles].sort((a, b) =>
    isHorizontal ? a.x - b.x : a.y - b.y,
  );
  const first = sortedTiles[0];
  const last = sortedTiles[sortedTiles.length - 1];

  const wordChars = sortedTiles.map((t) => board[t.y][t.x]);

  // Collect frozen runs on each side
  const beforeRun = collectFrozenRun(
    first.x - dx, first.y - dy, -dx, -dy,
  );
  const afterRun = collectFrozenRun(
    last.x + dx, last.y + dy, dx, dy,
  );

  // Check each side independently
  if (beforeRun && isInvalidCombined(beforeRun, true)) return true;
  if (afterRun && isInvalidCombined(afterRun, false)) return true;

  // Sandwich check: both sides have frozen runs, validate full sequence
  if (beforeRun && afterRun) {
    const full = [
      ...beforeRun.chars.slice().reverse(),
      ...wordChars,
      ...afterRun.chars,
    ];
    const fullText = full
      .join("")
      .normalize("NFC")
      .toLowerCase();
    const fullReversed = [...fullText].reverse().join("");
    if (!dictionary.has(fullText) && !dictionary.has(fullReversed)) {
      return true;
    }
  }

  return false;

  function collectFrozenRun(
    startX: number,
    startY: number,
    stepX: number,
    stepY: number,
  ): { chars: string[] } | null {
    if (
      startX < 0 || startX >= BOARD_SIZE ||
      startY < 0 || startY >= BOARD_SIZE ||
      !frozenTileSet.has(`${startX},${startY}`)
    ) {
      return null;
    }

    const chars: string[] = [];
    let cx = startX;
    let cy = startY;
    while (
      cx >= 0 && cx < BOARD_SIZE &&
      cy >= 0 && cy < BOARD_SIZE &&
      frozenTileSet.has(`${cx},${cy}`)
    ) {
      chars.push(board[cy][cx]);
      cx += stepX;
      cy += stepY;
    }

    // Only apply if the frozen run is itself a valid word
    const frozenText = chars
      .join("")
      .normalize("NFC")
      .toLowerCase();
    const frozenReversed = [...frozenText].reverse().join("");
    if (!dictionary.has(frozenText) && !dictionary.has(frozenReversed)) {
      return null;
    }

    return { chars };
  }

  function isInvalidCombined(
    run: { chars: string[] },
    isBefore: boolean,
  ): boolean {
    const combined = isBefore
      ? [...[...run.chars].reverse(), ...wordChars]
      : [...wordChars, ...run.chars];
    const combinedText = combined
      .join("")
      .normalize("NFC")
      .toLowerCase();
    const combinedReversed = [...combinedText].reverse().join("");
    return (
      !dictionary.has(combinedText) &&
      !dictionary.has(combinedReversed)
    );
  }
}

/**
 * Check whether a candidate word has BOTH same-axis boundaries
 * extending into invalid (non-dictionary) sequences.
 *
 * A boundary is "OK" when it reaches the board edge or when the
 * 1-tile extension forms a valid dictionary word (either direction).
 * The word is rejected only when BOTH boundaries are violated.
 */
export function violatesSameAxisBoundary(
  word: BoardWord,
  board: BoardGrid,
  dictionary: Set<string>,
): boolean {
  const { minimumWordLength } = DEFAULT_GAME_CONFIG;
  const isHorizontal =
    word.direction === "right" || word.direction === "left";
  const dx = isHorizontal ? 1 : 0;
  const dy = isHorizontal ? 0 : 1;

  const sortedTiles = [...word.tiles].sort((a, b) =>
    isHorizontal ? a.x - b.x : a.y - b.y,
  );
  const first = sortedTiles[0];
  const last = sortedTiles[sortedTiles.length - 1];

  const beforeX = first.x - dx;
  const beforeY = first.y - dy;
  const afterX = last.x + dx;
  const afterY = last.y + dy;

  const beforeAtEdge =
    beforeX < 0 || beforeX >= BOARD_SIZE ||
    beforeY < 0 || beforeY >= BOARD_SIZE;
  const afterAtEdge =
    afterX < 0 || afterX >= BOARD_SIZE ||
    afterY < 0 || afterY >= BOARD_SIZE;

  // If either boundary is at the board edge, the word passes
  if (beforeAtEdge || afterAtEdge) return false;

  const wordChars = sortedTiles.map((t) => board[t.y][t.x]);

  // Check before boundary: prepend the adjacent tile
  const beforeChar = board[beforeY][beforeX];
  const beforeSeq = [beforeChar, ...wordChars]
    .join("")
    .normalize("NFC")
    .toLowerCase();
  const beforeSeqRev = [...beforeSeq].reverse().join("");
  const beforeOk =
    beforeSeq.length < minimumWordLength ||
    dictionary.has(beforeSeq) ||
    dictionary.has(beforeSeqRev);

  // Check after boundary: append the adjacent tile
  const afterChar = board[afterY][afterX];
  const afterSeq = [...wordChars, afterChar]
    .join("")
    .normalize("NFC")
    .toLowerCase();
  const afterSeqRev = [...afterSeq].reverse().join("");
  const afterOk =
    afterSeq.length < minimumWordLength ||
    dictionary.has(afterSeq) ||
    dictionary.has(afterSeqRev);

  // Reject only when BOTH boundaries are violated
  return !beforeOk && !afterOk;
}

/**
 * Check whether two words share any tile coordinates along the same
 * axis (both horizontal or both vertical). Perpendicular words may
 * share a single crossing tile — that is valid and expected.
 */
function wordsOverlapSameAxis(a: BoardWord, b: BoardWord): boolean {
  const aHoriz = a.direction === "right" || a.direction === "left";
  const bHoriz = b.direction === "right" || b.direction === "left";
  if (aHoriz !== bHoriz) return false;

  const setA = new Set(a.tiles.map((t) => `${t.x},${t.y}`));
  return b.tiles.some((t) => setA.has(`${t.x},${t.y}`));
}

/**
 * True when two words on the same axis are physically contiguous
 * (one ends where the other begins, with no gap between them).
 *
 * Standalone invariant: a scored word must end at an unscored tile or
 * the board edge — it cannot continue into another scored word.
 */
function wordsAdjacentOnSameAxis(a: BoardWord, b: BoardWord): boolean {
  const aHoriz = a.direction === "right" || a.direction === "left";
  const bHoriz = b.direction === "right" || b.direction === "left";
  if (aHoriz !== bHoriz) return false;

  if (aHoriz) {
    if (a.tiles[0].y !== b.tiles[0].y) return false;
    const aMinX = Math.min(...a.tiles.map((t) => t.x));
    const aMaxX = Math.max(...a.tiles.map((t) => t.x));
    const bMinX = Math.min(...b.tiles.map((t) => t.x));
    const bMaxX = Math.max(...b.tiles.map((t) => t.x));
    return aMaxX + 1 === bMinX || bMaxX + 1 === aMinX;
  }

  if (a.tiles[0].x !== b.tiles[0].x) return false;
  const aMinY = Math.min(...a.tiles.map((t) => t.y));
  const aMaxY = Math.max(...a.tiles.map((t) => t.y));
  const bMinY = Math.min(...b.tiles.map((t) => t.y));
  const bMaxY = Math.max(...b.tiles.map((t) => t.y));
  return aMaxY + 1 === bMinY || bMaxY + 1 === aMinY;
}

/**
 * Check that no two words in the subset overlap or are adjacent along
 * the same axis. Adjacent words violate the standalone invariant: each
 * scored word must end at an unscored tile or the board edge.
 */
function hasNoSameAxisConflict(subset: BoardWord[]): boolean {
  for (let i = 0; i < subset.length; i++) {
    for (let j = i + 1; j < subset.length; j++) {
      if (wordsOverlapSameAxis(subset[i], subset[j])) return false;
      if (wordsAdjacentOnSameAxis(subset[i], subset[j])) return false;
    }
  }
  return true;
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
