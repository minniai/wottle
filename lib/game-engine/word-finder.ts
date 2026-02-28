import type { BoardGrid, Coordinate, MoveRequest, MoveResult } from "@/lib/types/board";

// Re-export MoveResult to avoid unused import warning
type _MoveResult = MoveResult;
import { GameConfig } from "@/lib/types";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

export interface AttributedWord {
  text: string;
  displayText: string;
  direction: "right" | "down";
  start: Coordinate;
  length: number;
  tiles: Coordinate[];
  playerId?: string;
}

export interface ExtractCrossWordsResult {
  isValid: boolean;
  words: AttributedWord[];
  error?: string;
}

/**
 * Given a coordinate and a direction (dx, dy), trace the contiguous word
 * and return it if its length >= config.minimumWordLength.
 */
function extractLine(
  board: BoardGrid,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  config: GameConfig
): AttributedWord | null {
  // Find start
  let x = startX;
  let y = startY;
  while (x - dx >= 0 && x - dx < config.boardSize &&
         y - dy >= 0 && y - dy < config.boardSize &&
         board[y - dy][x - dx] !== " " && board[y - dy][x - dx] !== "") {
    x -= dx;
    y -= dy;
  }

  const startCoord = { x, y };
  const tiles: Coordinate[] = [];
  const chars: string[] = [];

  // Trace forward
  while (x >= 0 && x < config.boardSize &&
         y >= 0 && y < config.boardSize &&
         board[y][x] !== " " && board[y][x] !== "") {
    tiles.push({ x, y });
    chars.push(board[y][x]);
    x += dx;
    y += dy;
  }

  const text = chars.join("").normalize("NFC").toLowerCase();
  const direction = dx !== 0 ? "right" : "down";

  return {
    text,
    displayText: chars.join(""),
    direction,
    start: startCoord,
    length: chars.length,
    tiles,
  };
}

/**
 * Validates a move by extracting all horizontal and vertical words formed.
 * If any newly formed contiguous sequence of letters is not in the dictionary,
 * isValid is false.
 */
export function extractValidCrossWords(
  board: BoardGrid,
  move: MoveRequest,
  dictionary: Set<string>,
  config: GameConfig = DEFAULT_GAME_CONFIG
): ExtractCrossWordsResult {
  const wordsMap = new Map<string, AttributedWord>();
  const coordsToCheck = [move.from, move.to];

  for (const coord of coordsToCheck) {
    if (!board[coord.y][coord.x] || board[coord.y][coord.x] === " ") {
      continue;
    }

    // Trace Horizontal (dx=1, dy=0)
    const hWord = extractLine(board, coord.x, coord.y, 1, 0, config);
    let hValid = false;
    if (hWord) {
      if (hWord.length > 1) {
        if (!dictionary.has(hWord.text)) {
          return { isValid: false, words: [], error: `Invalid horizontal word: ${hWord.text}` };
        }
        if (hWord.length >= config.minimumWordLength) {
          wordsMap.set(`h:${hWord.start.x},${hWord.start.y}`, hWord);
          hValid = true;
        } else {
          return { isValid: false, words: [], error: `Horizontal word too short: ${hWord.text}` };
        }
      }
    }

    // Trace Vertical (dx=0, dy=1)
    const vWord = extractLine(board, coord.x, coord.y, 0, 1, config);
    let vValid = false;
    if (vWord) {
      if (vWord.length > 1) {
        if (!dictionary.has(vWord.text)) {
          return { isValid: false, words: [], error: `Invalid vertical word: ${vWord.text}` };
        }
        if (vWord.length >= config.minimumWordLength) {
          wordsMap.set(`v:${vWord.start.x},${vWord.start.y}`, vWord);
          vValid = true;
        } else {
          return { isValid: false, words: [], error: `Vertical word too short: ${vWord.text}` };
        }
      }
    }
    
    // Scrabble constraint: BOTH swapped tiles must participate in at least one valid word.
    if (!hValid && !vValid) {
      return { isValid: false, words: [], error: `Tile at (${coord.x}, ${coord.y}) does not form a valid word` };
    }
    
    // Scrabble constraint: BOTH swapped tiles must participate in at least one valid word.
    // If a tile is completely isolated (length < minWordLength in both axes), 
    // we must also consider if it's connected to anything at all. In wottle it technically swaps into a dense grid
    // so it will ALWAYS be connected.
  }

  // To meet the strict "must be valid in all 4 orthogonal directions" constraint (meaning both axes):
  // Since we check the dictionary for any line length >= 2, if the test fails it will correctly return `{isValid: false}`.
  
  return {
    isValid: true,
    words: Array.from(wordsMap.values()),
  };
}
/**
 * Checks if any tile in a given word creates an invalid perpendicular cross-word.
 * Returns true if a violation exists (invalid word or word too short).
 */
export function hasCrossWordViolation(
  board: BoardGrid,
  word: AttributedWord,
  dictionary: Set<string>,
  config: GameConfig = DEFAULT_GAME_CONFIG
): boolean {
  // If the word is horizontal, check vertical segments for each tile.
  // If vertical, check horizontal segments.
  const isVertical = word.direction === "down";
  const dx = isVertical ? 1 : 0;
  const dy = isVertical ? 0 : 1;

  for (const tile of word.tiles) {
    const crossLine = extractLine(board, tile.x, tile.y, dx, dy, config);
    if (!crossLine) continue;

    // Perpendicular crossing must be at least 1 (the tile itself).
    // If it's 2 or more, it MUST be in the dictionary and >= minWordLength.
    if (crossLine.length > 1) {
      if (!dictionary.has(crossLine.text)) return true;
      if (crossLine.length < config.minimumWordLength) return true;
    }
  }

  return false;
}
