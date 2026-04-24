import type { BoardGrid, BoardWord } from "@/lib/types/board";
import type { FrozenTileMap, ScoredAxis } from "@/lib/types/match";
import { BOARD_SIZE } from "@/lib/constants/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";
import {
  calculateLetterPoints,
  calculateLengthBonus,
} from "./scorer";

/**
 * Does `runChars` contain a dictionary word of length >=
 * `minLen` that includes the tile at `tileIdx`?
 *
 * This is the per-letter coverage check: each letter of a
 * newly-scored word must sit inside some valid sub-run in every
 * direction where it has scored neighbors (issue #195).
 */
function runContainsValidSubRunCoveringIndex(
  runChars: string[],
  tileIdx: number,
  dictionary: Set<string>,
  minLen: number,
): boolean {
  const runLen = runChars.length;
  if (runLen < minLen) return false;
  for (let start = 0; start <= tileIdx; start++) {
    const minEnd = Math.max(tileIdx + 1, start + minLen);
    for (let end = minEnd; end <= runLen; end++) {
      const sub = runChars
        .slice(start, end)
        .join("")
        .normalize("NFC")
        .toLowerCase();
      if (dictionary.has(sub)) return true;
      const rev = [...sub].reverse().join("");
      if (dictionary.has(rev)) return true;
    }
  }
  return false;
}

/**
 * Check whether a candidate word creates an invalid perpendicular
 * scored run through any of its tiles.
 *
 * Rule (issue #195): for each tile of the candidate, trace the
 * maximal contiguous scored run on the cross-axis through that
 * tile. Every frozen tile physically on the board counts, regardless
 * of which axis it was originally scored on — this is about the
 * physical board state, not metadata. The run is OK iff:
 *   - length 1 (no scored neighbors), OR
 *   - contains a dict-valid sub-run of length >= `minimumWordLength`
 *     that includes this tile.
 * A run of length 2..(minimumWordLength-1) is always a violation:
 * it cannot contain any sub-run of length >= `minimumWordLength`.
 *
 * Replaces the pre-#185 "combined run must itself be a dict word"
 * rule (too strict — rejected BÆN/BÁS in #136) and the #185
 * `scoredAxes`-based skip (too lenient — admitted "ML", "NÐ",
 * "TKH", etc. in #195).
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

  const isEstablished = (x: number, y: number) => {
    const key = `${x},${y}`;
    return extraTileSet.has(key) || frozenTileSet.has(key);
  };

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

    const runChars = [
      ...beforeChars,
      board[tile.y][tile.x],
      ...afterChars,
    ];
    const tileIdx = beforeChars.length;
    const runLen = runChars.length;
    if (runLen === 1) continue; // no scored neighbor — no constraint
    if (runLen < minimumWordLength) return true;
    if (
      !runContainsValidSubRunCoveringIndex(
        runChars,
        tileIdx,
        dictionary,
        minimumWordLength,
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Does a candidate word physically abut a prior same-axis scored run
 * such that the combined sequence is not a dict word?
 *
 * Enforces the standalone invariant (game_rules §3.5, I7) across
 * rounds: a scored word must end at an unscored tile or the board
 * edge, or — if it meets another scored word head-on on the same
 * axis — the combined sequence must itself be a dict word. The
 * within-round version lives in `hasNoSameAxisConflict`; this one
 * catches the cross-round case (issue #200, ÖRLTEL / ÞESSINÓK /
 * NEFÞEMA pattern).
 *
 * Uses `scoredAxes` metadata when available: a frozen tile extends
 * the new word's axis iff it was previously scored on that axis.
 * Legacy tiles without `scoredAxes` fall back to a physical-run
 * heuristic: the extension counts only if the contiguous frozen run
 * is itself a dict word (meaning it was almost certainly scored on
 * this axis). This preserves #136 (Þ scored vertically, adjacent to
 * horizontal BÆN, does not extend a horizontal scored run) and #195
 * (cross-axis per-letter coverage is independent).
 */
function violatesFrozenAdjacencyOnSameAxis(
  word: BoardWord,
  board: BoardGrid,
  frozenTileSet: Set<string>,
  frozenTileMap: FrozenTileMap,
  dictionary: Set<string>,
): boolean {
  const isHorizontal =
    word.direction === "right" || word.direction === "left";
  const wordAxis: ScoredAxis = isHorizontal ? "horizontal" : "vertical";
  const dx = isHorizontal ? 1 : 0;
  const dy = isHorizontal ? 0 : 1;

  const sortedTiles = [...word.tiles].sort((a, b) =>
    isHorizontal ? a.x - b.x : a.y - b.y,
  );
  const first = sortedTiles[0];
  const last = sortedTiles[sortedTiles.length - 1];
  const wordChars = sortedTiles.map((t) => board[t.y][t.x]);

  const beforeRun = collectFrozenRun(first.x - dx, first.y - dy, -dx, -dy);
  const afterRun = collectFrozenRun(last.x + dx, last.y + dy, dx, dy);

  if (beforeRun && isInvalidCombined(beforeRun, true)) return true;
  if (afterRun && isInvalidCombined(afterRun, false)) return true;

  if (beforeRun && afterRun) {
    const full = [
      ...[...beforeRun.chars].reverse(),
      ...wordChars,
      ...afterRun.chars,
    ];
    if (!isDictWord(full)) return true;
  }

  return false;

  function isDictWord(chars: string[]): boolean {
    const text = chars.join("").normalize("NFC").toLowerCase();
    const reversed = [...text].reverse().join("");
    return dictionary.has(text) || dictionary.has(reversed);
  }

  function isSameAxisFrozen(x: number, y: number): boolean {
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false;
    if (!frozenTileSet.has(`${x},${y}`)) return false;
    const meta = frozenTileMap[`${x},${y}`];
    // Legacy frozen tiles without scoredAxes: count as same-axis and
    // let the dict-gate on the frozen run decide.
    if (!meta || !meta.scoredAxes) return true;
    return meta.scoredAxes.includes(wordAxis);
  }

  function hasScoredAxes(x: number, y: number): boolean {
    const meta = frozenTileMap[`${x},${y}`];
    return Boolean(meta?.scoredAxes);
  }

  function collectFrozenRun(
    startX: number,
    startY: number,
    stepX: number,
    stepY: number,
  ): { chars: string[]; allHaveScoredAxes: boolean } | null {
    if (!isSameAxisFrozen(startX, startY)) return null;

    const chars: string[] = [];
    let allHaveScoredAxes = true;
    let cx = startX;
    let cy = startY;
    while (isSameAxisFrozen(cx, cy)) {
      chars.push(board[cy][cx]);
      if (!hasScoredAxes(cx, cy)) allHaveScoredAxes = false;
      cx += stepX;
      cy += stepY;
    }
    return { chars, allHaveScoredAxes };
  }

  function isInvalidCombined(
    run: { chars: string[]; allHaveScoredAxes: boolean },
    isBefore: boolean,
  ): boolean {
    // Legacy gate: when any tile in the frozen run lacks scoredAxes,
    // only treat the run as a prior same-axis scored word if its
    // letters form a dict word. Single letters (never dict words) are
    // skipped — this preserves #136 where a single Þ is a perpendicular
    // incidental neighbor, not an extension.
    if (!run.allHaveScoredAxes) {
      if (!isDictWord(run.chars)) return false;
    }
    const combined = isBefore
      ? [...[...run.chars].reverse(), ...wordChars]
      : [...wordChars, ...run.chars];
    return !isDictWord(combined);
  }
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
 * 1. Generate all non-empty subsets of candidates.
 * 2. For each subset, verify mutual cross-validation consistency.
 * 3. Return the subset with the maximum total score.
 *
 * No individual pre-filter: a candidate's per-letter coverage can
 * depend on another candidate in the same round (BÁS in #136 relies
 * on BÆN's tiles to reach a length-3+ horizontal scored run that
 * contains BÆN). Defer all cross-validation to the subset stage so
 * mutual extras are available.
 */
export function selectOptimalCombination(
  candidates: BoardWord[],
  board: BoardGrid,
  frozenTiles: FrozenTileMap,
  dictionary: Set<string>,
  _playerSlot: "player_a" | "player_b",
): BoardWord[] {
  if (candidates.length === 0) return [];

  const frozenTileSet = new Set(Object.keys(frozenTiles));

  let bestSubset: BoardWord[] = [];
  let bestScore = -1;

  const n = candidates.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset: BoardWord[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        subset.push(candidates[i]);
      }
    }

    if (!hasNoSameAxisConflict(subset)) continue;

    if (
      isSubsetValid(
        subset,
        board,
        frozenTileSet,
        frozenTiles,
        dictionary,
      )
    ) {
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
  frozenTileMap: FrozenTileMap,
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

    if (
      violatesFrozenAdjacencyOnSameAxis(
        subset[i],
        board,
        frozenTileSet,
        frozenTileMap,
        dictionary,
      )
    ) {
      return false;
    }
  }
  return true;
}
