import type { BoardGrid, BoardWord, Coordinate, Direction } from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { BOARD_SIZE } from "@/lib/constants/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";
import {
  calculateLetterPoints,
  calculateLengthBonus,
} from "./scorer";

type Axis = "horizontal" | "vertical";

const keyOf = ({ x, y }: Coordinate): string => `${x},${y}`;

function axisOf(word: BoardWord): Axis {
  return word.direction === "right" || word.direction === "left" ? "horizontal" : "vertical";
}

function otherAxis(axis: Axis): Axis {
  return axis === "horizontal" ? "vertical" : "horizontal";
}

function stepAlong(axis: Axis): { dx: number; dy: number } {
  return axis === "horizontal" ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
}

function isOnBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/**
 * The maximal contiguous run of `scored` tiles through `tile` along `axis`,
 * left to right or top to bottom. `tile` itself must be in `scored`.
 */
function runThrough(tile: Coordinate, axis: Axis, scored: Set<string>): Coordinate[] {
  const { dx, dy } = stepAlong(axis);
  let { x, y } = tile;
  while (isOnBoard(x - dx, y - dy) && scored.has(`${x - dx},${y - dy}`)) {
    x -= dx;
    y -= dy;
  }
  const run: Coordinate[] = [];
  for (; isOnBoard(x, y) && scored.has(`${x},${y}`); x += dx, y += dy) run.push({ x, y });
  return run;
}

/**
 * Rules §3.5a / I7a: a scored word ends at an unfrozen letter or the edge.
 * A new word that meets a frozen letter end to end on its own axis is not the
 * word on that line — the whole run is, and the scanner offers it separately
 * because it passes through the same swapped letter (PAT under frozen GILDA's
 * I is refused; PATI is the word, 2026-09-23).
 */
function endsAgainstFrozen(word: BoardWord, frozen: Set<string>): boolean {
  const { dx, dy } = stepAlong(axisOf(word));
  const ordered = [...word.tiles].sort((a, b) => a.x - b.x || a.y - b.y);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  return frozen.has(`${first.x - dx},${first.y - dy}`) || frozen.has(`${last.x + dx},${last.y + dy}`);
}

function wordOnRun(board: BoardGrid, tiles: Coordinate[], direction: Direction): BoardWord {
  const displayText = tiles.map(({ x, y }) => board[y][x]).join("");
  return {
    text: displayText.normalize("NFC").toLowerCase(),
    displayText,
    direction,
    start: tiles[0],
    length: tiles.length,
    tiles,
  };
}

/** The run read forward and backward, keeping each reading that is a word (§3.1). */
function readingsOf(
  run: Coordinate[],
  axis: Axis,
  board: BoardGrid,
  dictionary: Set<string>,
): BoardWord[] {
  const [forward, reverse]: Direction[] = axis === "horizontal" ? ["right", "left"] : ["down", "up"];
  return [wordOnRun(board, run, forward), wordOnRun(board, [...run].reverse(), reverse)].filter((w) =>
    dictionary.has(w.text),
  );
}

function coversExactly(word: BoardWord, run: Set<string>): boolean {
  return word.tiles.length === run.size && word.tiles.every((t) => run.has(keyOf(t)));
}

/**
 * Rules §4 / I3: the run a new letter makes on the other axis. A single letter
 * is free; a run that is exactly a word of the subset is that word; a run that
 * swallows part of a subset word would make two bands touch; otherwise the
 * whole run must be a word and is scored by the same move (GILDA's I under
 * frozen PAT scores PATI, 2026-09-23). `null` refuses the subset.
 */
function settleRun(
  run: Coordinate[],
  axis: Axis,
  subset: BoardWord[],
  board: BoardGrid,
  dictionary: Set<string>,
): BoardWord[] | null {
  if (run.length === 1) return [];
  const runKeys = new Set(run.map(keyOf));
  const onAxis = subset.filter((w) => axisOf(w) === axis);
  if (onAxis.some((w) => coversExactly(w, runKeys))) return [];
  if (onAxis.some((w) => w.tiles.some((t) => runKeys.has(keyOf(t))))) return null;
  if (run.length < DEFAULT_GAME_CONFIG.minimumWordLength) return null;
  const readings = readingsOf(run, axis, board, dictionary);
  return readings.length > 0 ? readings : null;
}

/** A frozen letter's cross run changes only when a subset letter lands beside it. */
function crossRunUnchanged(tile: Coordinate, axis: Axis, frozen: Set<string>, placed: Set<string>): boolean {
  if (!frozen.has(keyOf(tile))) return false;
  const { dx, dy } = stepAlong(axis);
  return !placed.has(`${tile.x - dx},${tile.y - dy}`) && !placed.has(`${tile.x + dx},${tile.y + dy}`);
}

/** The words the subset's letters make on the other axis, or `null` if one is not a word. */
function crossRunWords(
  subset: BoardWord[],
  board: BoardGrid,
  frozen: Set<string>,
  dictionary: Set<string>,
): BoardWord[] | null {
  const placed = new Set(subset.flatMap((w) => w.tiles.map(keyOf)));
  const scored = new Set([...frozen, ...placed]);
  const found = new Map<string, BoardWord>();
  for (const word of subset) {
    const axis = otherAxis(axisOf(word));
    for (const tile of word.tiles) {
      if (crossRunUnchanged(tile, axis, frozen, placed)) continue;
      const words = settleRun(runThrough(tile, axis, scored), axis, subset, board, dictionary);
      if (words === null) return null;
      for (const w of words) found.set(`${w.direction}:${w.tiles.map(keyOf).join(" ")}`, w);
    }
  }
  return [...found.values()];
}

/**
 * Every scored run on the board is one scored word (rules §3.5a, §4; I3, I7a).
 * Returns the words the subset scores — its own and the cross runs its new
 * letters complete — or `null` when the subset breaks the rule.
 */
function settleSubset(
  subset: BoardWord[],
  board: BoardGrid,
  frozen: Set<string>,
  dictionary: Set<string>,
): BoardWord[] | null {
  if (subset.some((w) => endsAgainstFrozen(w, frozen))) return null;
  const crossRuns = crossRunWords(subset, board, frozen, dictionary);
  return crossRuns && [...subset, ...crossRuns];
}

/**
 * Calculate total score for a word (letter points + length bonus).
 */
function scoreWord(word: BoardWord, letterValues?: Record<string, number>): number {
  return calculateLetterPoints(word.text, letterValues) + calculateLengthBonus(word.length);
}

/**
 * Select the highest-scoring subset of candidate words that satisfies
 * the global cross-validation invariant (FR-014, FR-014a).
 *
 * Algorithm:
 * 1. Generate all non-empty subsets of candidates.
 * 2. For each subset, settle it: every scored run it makes is one scored
 *    word (`settleSubset`), adding the cross runs its new letters complete.
 * 3. Return the settled words with the maximum total score.
 *
 * No individual pre-filter: a candidate's per-letter coverage can
 * depend on another candidate in the same round (BÁS in #136 relies
 * on BÆN's tiles to complete its horizontal scored run).
 * Defer all cross-validation to the subset stage so
 * mutual extras are available.
 */
export function selectOptimalCombination(
  candidates: BoardWord[],
  board: BoardGrid,
  frozenTiles: FrozenTileMap,
  dictionary: Set<string>,
  _playerSlot: "player_a" | "player_b",
  /** The match language's values (spec 060); Icelandic when omitted, as every scorer defaults. */
  letterValues?: Record<string, number>,
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

    const scored = settleSubset(subset, board, frozenTileSet, dictionary);
    if (scored) {
      const totalScore = scored.reduce(
        (sum, word) => sum + scoreWord(word, letterValues),
        0,
      );
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSubset = scored;
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
 *
 * Exception (§3.1): If two words cover the EXACT same tiles (e.g. forward
 * and backward reading of the same word), they are allowed to co-exist.
 */
function hasNoSameAxisConflict(subset: BoardWord[]): boolean {
  for (let i = 0; i < subset.length; i++) {
    for (let j = i + 1; j < subset.length; j++) {
      const a = subset[i];
      const b = subset[j];
      if (wordsOverlapSameAxis(a, b)) {
        // Exception: Double reading of the same tiles is allowed.
        const aTiles = a.tiles.map((t) => `${t.x},${t.y}`).sort().join("|");
        const bTiles = b.tiles.map((t) => `${t.x},${t.y}`).sort().join("|");
        if (aTiles === bTiles) {
          continue; // allowed
        }
        return false;
      }
      if (wordsAdjacentOnSameAxis(a, b)) return false;
    }
  }
  return true;
}
