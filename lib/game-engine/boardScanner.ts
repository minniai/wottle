import type {
  BoardGrid,
  BoardWord,
  Coordinate,
  Direction,
  ScanResult,
} from "@/lib/types/board";
import type { GameConfig } from "@/lib/types/game-config";
import { BOARD_SIZE } from "@/lib/constants/board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

/** Direction vectors for the 4 canonical directions. */
const DIRECTION_VECTORS: Array<{
  dx: number;
  dy: number;
  forward: Direction;
  reverse: Direction;
}> = [
  { dx: 1, dy: 0, forward: "right", reverse: "left" },
  { dx: 0, dy: 1, forward: "down", reverse: "up" },
  { dx: 1, dy: 1, forward: "down-right", reverse: "up-left" },
  { dx: -1, dy: 1, forward: "down-left", reverse: "up-right" },
];

/**
 * Extract a line of characters from the board along a direction.
 * Returns the characters and their coordinates.
 */
function extractLine(
  board: BoardGrid,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
): { chars: string[]; coords: Coordinate[] } {
  const chars: string[] = [];
  const coords: Coordinate[] = [];
  let x = startX;
  let y = startY;

  while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
    chars.push(board[y][x]);
    coords.push({ x, y });
    x += dx;
    y += dy;
  }

  return { chars, coords };
}

/**
 * Build a BoardWord from a subsequence of a line.
 */
function buildBoardWord(
  chars: string[],
  coords: Coordinate[],
  startIdx: number,
  length: number,
  direction: Direction,
): BoardWord {
  const subChars = chars.slice(startIdx, startIdx + length);
  const subCoords = coords.slice(startIdx, startIdx + length);
  const text = subChars.join("").normalize("NFC").toLowerCase();
  const displayText = subChars.join("");

  return {
    text,
    displayText,
    direction,
    start: subCoords[0],
    length,
    tiles: subCoords,
  };
}

/**
 * Build a BoardWord from a reversed subsequence of a line.
 */
function buildReverseBoardWord(
  chars: string[],
  coords: Coordinate[],
  startIdx: number,
  length: number,
  direction: Direction,
): BoardWord {
  const subChars = chars.slice(startIdx, startIdx + length);
  const subCoords = coords.slice(startIdx, startIdx + length);

  const reversedChars = [...subChars].reverse();
  const reversedCoords = [...subCoords].reverse();

  const text = reversedChars.join("").normalize("NFC").toLowerCase();
  const displayText = reversedChars.join("");

  return {
    text,
    displayText,
    direction,
    start: reversedCoords[0],
    length,
    tiles: reversedCoords,
  };
}

/**
 * Compute starting positions for each canonical direction.
 */
function getStartPositions(
  dx: number,
  dy: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  if (dx === 1 && dy === 0) {
    // Horizontal → start at column 0, all rows
    for (let y = 0; y < BOARD_SIZE; y++) {
      positions.push({ x: 0, y });
    }
  } else if (dx === 0 && dy === 1) {
    // Vertical → start at row 0, all columns
    for (let x = 0; x < BOARD_SIZE; x++) {
      positions.push({ x, y: 0 });
    }
  } else if (dx === 1 && dy === 1) {
    // Down-right diagonal → start along top row and left column
    for (let x = 0; x < BOARD_SIZE; x++) {
      positions.push({ x, y: 0 });
    }
    for (let y = 1; y < BOARD_SIZE; y++) {
      positions.push({ x: 0, y });
    }
  } else if (dx === -1 && dy === 1) {
    // Down-left diagonal → start along top row and right column
    for (let x = 0; x < BOARD_SIZE; x++) {
      positions.push({ x, y: 0 });
    }
    for (let y = 1; y < BOARD_SIZE; y++) {
      positions.push({ x: BOARD_SIZE - 1, y });
    }
  }

  return positions;
}

/** Orthogonal direction vectors (no diagonals). */
const ORTHOGONAL_VECTORS: Array<{
  dx: number;
  dy: number;
  forward: Direction;
  reverse: Direction;
}> = [
  { dx: 1, dy: 0, forward: "right", reverse: "left" },
  { dx: 0, dy: 1, forward: "down", reverse: "up" },
];

/**
 * Exhaustive orthogonal word scanner from swap coordinates (FR-001–FR-004, FR-020).
 *
 * For each swap coordinate, traces 2 orthogonal axes (horizontal, vertical),
 * extracts the full line through that coordinate, and enumerates ALL valid
 * dictionary subsequences whose length meets `config.minimumWordLength`.
 * Both forward and reverse readings are checked.
 *
 * @param board - 10×10 grid of letters
 * @param swapCoordinates - Coordinates involved in the swap
 * @param dictionary - Set of valid words (NFC-normalized, lowercase)
 * @param config - Game config; `minimumWordLength` governs the minimum subsequence length.
 *                Defaults to `DEFAULT_GAME_CONFIG` (3 per PRD §1.2).
 * @returns All valid words found through swap coordinates (deduplicated)
 */
export function scanFromSwapCoordinates(
  board: BoardGrid,
  swapCoordinates: Coordinate[],
  dictionary: Set<string>,
  config: GameConfig = DEFAULT_GAME_CONFIG,
): BoardWord[] {
  const { minimumWordLength } = config;
  const words: BoardWord[] = [];
  const seen = new Set<string>();

  for (const coord of swapCoordinates) {
    for (const { dx, dy, forward, reverse } of ORTHOGONAL_VECTORS) {
      // Trace backward to find line start
      let startX = coord.x;
      let startY = coord.y;
      while (
        startX - dx >= 0 &&
        startX - dx < BOARD_SIZE &&
        startY - dy >= 0 &&
        startY - dy < BOARD_SIZE
      ) {
        startX -= dx;
        startY -= dy;
      }

      const { chars, coords } = extractLine(board, startX, startY, dx, dy);
      const lineLen = chars.length;

      // Find the index of the swap coordinate in this line
      const swapIdx = coords.findIndex(
        (c) => c.x === coord.x && c.y === coord.y,
      );
      if (swapIdx === -1) continue;

      // Enumerate all subsequences that include swapIdx and meet the minimum length
      for (let start = 0; start <= swapIdx; start++) {
        for (let end = swapIdx + 1; end <= lineLen; end++) {
          const len = end - start;
          if (len < minimumWordLength) continue;

          // Forward direction
          const fwd = buildBoardWord(chars, coords, start, len, forward);
          const fwdKey = `${fwd.text}:${fwd.direction}:${fwd.start.x},${fwd.start.y}`;
          if (!seen.has(fwdKey) && dictionary.has(fwd.text)) {
            seen.add(fwdKey);
            words.push(fwd);
          }

          // Reverse direction
          const rev = buildReverseBoardWord(
            chars,
            coords,
            start,
            len,
            reverse,
          );
          const revKey = `${rev.text}:${rev.direction}:${rev.start.x},${rev.start.y}`;
          if (!seen.has(revKey) && dictionary.has(rev.text)) {
            seen.add(revKey);
            words.push(rev);
          }
        }
      }
    }
  }

  return words;
}

/**
 * Scan a board in all 8 directions for valid dictionary words.
 *
 * Uses 4 canonical directions with forward + reverse reading
 * to cover all 8 directions. Extracts all contiguous subsequences
 * whose length meets `config.minimumWordLength` and checks each
 * against the dictionary.
 *
 * @param board - 10×10 grid of letters
 * @param dictionary - Set of valid words (NFC-normalized, lowercase)
 * @param config - Game config; `minimumWordLength` governs the minimum subsequence length.
 *                Defaults to `DEFAULT_GAME_CONFIG` (3 per PRD §1.2).
 * @returns All valid words found with their coordinates and timing
 */
export function scanBoard(
  board: BoardGrid,
  dictionary: Set<string>,
  config: GameConfig = DEFAULT_GAME_CONFIG,
): ScanResult {
  const { minimumWordLength } = config;
  const scannedAt = performance.now();
  const words: BoardWord[] = [];
  const seen = new Set<string>();

  for (const { dx, dy, forward, reverse } of DIRECTION_VECTORS) {
    const startPositions = getStartPositions(dx, dy);

    for (const { x, y } of startPositions) {
      const { chars, coords } = extractLine(board, x, y, dx, dy);
      const lineLen = chars.length;

      if (lineLen < minimumWordLength) {
        continue;
      }

      for (let start = 0; start <= lineLen - minimumWordLength; start++) {
        for (
          let len = minimumWordLength;
          len <= lineLen - start;
          len++
        ) {
          // Forward direction
          const fwd = buildBoardWord(chars, coords, start, len, forward);
          const fwdKey = `${fwd.text}:${fwd.direction}:${fwd.start.x},${fwd.start.y}`;
          if (!seen.has(fwdKey) && dictionary.has(fwd.text)) {
            seen.add(fwdKey);
            words.push(fwd);
          }

          // Reverse direction
          const rev = buildReverseBoardWord(
            chars,
            coords,
            start,
            len,
            reverse,
          );
          const revKey = `${rev.text}:${rev.direction}:${rev.start.x},${rev.start.y}`;
          if (!seen.has(revKey) && dictionary.has(rev.text)) {
            seen.add(revKey);
            words.push(rev);
          }
        }
      }
    }
  }

  const durationMs = performance.now() - scannedAt;

  return { words, scannedAt, durationMs };
}
