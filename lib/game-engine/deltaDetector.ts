import type {
  BoardGrid,
  BoardWord,
  Coordinate,
} from "@/lib/types/board";
import type { FrozenTileMap } from "@/lib/types/match";
import { scanBoard } from "./boardScanner";
import { applySwap } from "./board";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

/** A word attributed to a specific player. */
export interface AttributedWord extends BoardWord {
  playerId: string;
  /** "x,y" keys of tiles in this word frozen by the opponent (for partial letter scoring). */
  opponentFrozenKeys: ReadonlySet<string>;
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
 * Check whether a word creates an invalid perpendicular cross-word with any
 * established tile on the board.
 *
 * "Established" means: tiles frozen in prior rounds (frozenTileSet) OR tiles
 * belonging to the opponent's newly credited words in the same round
 * (extraTileSet). Non-established tiles — even if they happen to form
 * recognisable words — are ignored.
 *
 * For each tile T in `word`, the perpendicular direction is traced through
 * neighbouring positions that are in the established set. If the resulting
 * cross-sequence (established-tiles + T) is >= 2 tiles and not in the
 * dictionary, the word has a violation.
 */
function hasCrossWordViolation(
  board: BoardGrid,
  word: BoardWord,
  frozenTileSet: Set<string>,
  dictionary: Set<string>,
  extraTileSet: Set<string> = new Set(),
): boolean {
  const { boardSize, minimumWordLength } = DEFAULT_GAME_CONFIG;
  const isHorizontal = word.direction === "right" || word.direction === "left";
  // Perpendicular direction: vertical for horizontal words, horizontal for vertical words
  const dx = isHorizontal ? 0 : 1;
  const dy = isHorizontal ? 1 : 0;

  const isEstablished = (x: number, y: number) =>
    frozenTileSet.has(`${x},${y}`) || extraTileSet.has(`${x},${y}`);

  for (const tile of word.tiles) {
    // Trace backward (upward for horizontal words)
    const beforeChars: string[] = [];
    let bx = tile.x - dx;
    let by = tile.y - dy;
    while (
      bx >= 0 && bx < boardSize &&
      by >= 0 && by < boardSize &&
      isEstablished(bx, by)
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
      isEstablished(fx, fy)
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
      const crossWordReversed = [...crossWord].reverse().join("");
      // OR: valid if readable in either direction
      if (!dictionary.has(crossWord) && !dictionary.has(crossWordReversed)) return true;
      if (crossLength < minimumWordLength) return true;
    }
  }

  return false;
}

/**
 * Check whether a word's tile run, when extended along its own direction through
 * any adjacent established tiles (frozen from prior rounds or credited same-round
 * opponent tiles), forms an invalid longer sequence.
 *
 * Example: a new horizontal word "tur" immediately left of frozen "vol" tiles would
 * extend to "turvol". If "turvol" is not in the dictionary, the word is rejected.
 *
 * Only established tiles trigger the check — unestablished free tiles on the board
 * are ignored (they cannot be attributed and may change next round).
 */
function hasInlineExtensionViolation(
  board: BoardGrid,
  word: BoardWord,
  frozenTileSet: Set<string>,
  dictionary: Set<string>,
  extraTileSet: Set<string> = new Set(),
): boolean {
  const { boardSize } = DEFAULT_GAME_CONFIG;
  // Movement delta ALONG the word's own direction (opposite of hasCrossWordViolation)
  const isHorizontal = word.direction === "right" || word.direction === "left";
  const dx = isHorizontal ? 1 : 0;
  const dy = isHorizontal ? 0 : 1;

  const isEstablished = (x: number, y: number) =>
    frozenTileSet.has(`${x},${y}`) || extraTileSet.has(`${x},${y}`);

  // Extend backward from the first tile
  const firstTile = word.tiles[0];
  const beforeChars: string[] = [];
  let bx = firstTile.x - dx;
  let by = firstTile.y - dy;
  while (bx >= 0 && bx < boardSize && by >= 0 && by < boardSize && isEstablished(bx, by)) {
    beforeChars.unshift(board[by][bx]);
    bx -= dx;
    by -= dy;
  }

  // Extend forward from the last tile
  const lastTile = word.tiles[word.tiles.length - 1];
  const afterChars: string[] = [];
  let fx = lastTile.x + dx;
  let fy = lastTile.y + dy;
  while (fx >= 0 && fx < boardSize && fy >= 0 && fy < boardSize && isEstablished(fx, fy)) {
    afterChars.push(board[fy][fx]);
    fx += dx;
    fy += dy;
  }

  if (beforeChars.length === 0 && afterChars.length === 0) return false;

  const extended = [
    ...beforeChars,
    ...word.tiles.map((t) => board[t.y][t.x]),
    ...afterChars,
  ].join("").normalize("NFC").toLowerCase();

  const extendedReversed = [...extended].reverse().join("");
  // OR: valid if the extended sequence is a dictionary word in either reading direction
  return !dictionary.has(extended) && !dictionary.has(extendedReversed);
}

/**
 * True when `shorter` is fully contained within `longer` in the same direction.
 * Used to suppress sub-words so only the longest word in a tile run scores.
 */
function isStrictSubword(shorter: BoardWord, longer: BoardWord): boolean {
  if (shorter.direction !== longer.direction) return false;
  if (shorter.tiles.length >= longer.tiles.length) return false;
  switch (shorter.direction) {
    case "right": {
      const shorterEnd = shorter.start.x + shorter.tiles.length - 1;
      const longerEnd = longer.start.x + longer.tiles.length - 1;
      return (
        shorter.start.y === longer.start.y &&
        shorter.start.x >= longer.start.x &&
        shorterEnd <= longerEnd
      );
    }
    case "left": {
      // start.x is the rightmost tile; tiles extend leftward.
      const shorterEnd = shorter.start.x - shorter.tiles.length + 1;
      const longerEnd = longer.start.x - longer.tiles.length + 1;
      return (
        shorter.start.y === longer.start.y &&
        shorter.start.x <= longer.start.x &&
        shorterEnd >= longerEnd
      );
    }
    case "down": {
      const shorterEnd = shorter.start.y + shorter.tiles.length - 1;
      const longerEnd = longer.start.y + longer.tiles.length - 1;
      return (
        shorter.start.x === longer.start.x &&
        shorter.start.y >= longer.start.y &&
        shorterEnd <= longerEnd
      );
    }
    case "up": {
      // start.y is the bottommost tile; tiles extend upward.
      const shorterEnd = shorter.start.y - shorter.tiles.length + 1;
      const longerEnd = longer.start.y - longer.tiles.length + 1;
      return (
        shorter.start.x === longer.start.x &&
        shorter.start.y <= longer.start.y &&
        shorterEnd >= longerEnd
      );
    }
    default:
      return false;
  }
}

/**
 * Remove words that are strict sub-words of another word in the same list.
 * Ensures each player scores only the longest word in every tile run.
 */
function removeSubwords<T extends BoardWord>(words: T[]): T[] {
  return words.filter(
    (candidate) =>
      !words.some(
        (other) => other !== candidate && isStrictSubword(candidate, other),
      ),
  );
}

/**
 * Build the NFC-normalized lowercase text of the union span of two colinear
 * overlapping words. Tiles are sorted in the word's reading direction.
 * Returns null for diagonal or mismatched directions.
 */
function buildUnionText(
  a: BoardWord,
  b: BoardWord,
  board: BoardGrid,
): string | null {
  const aIsHorizontal = a.direction === "right" || a.direction === "left";
  const bIsHorizontal = b.direction === "right" || b.direction === "left";
  if (aIsHorizontal !== bIsHorizontal) return null;
  const seen = new Set<string>();
  const union: Coordinate[] = [];
  for (const t of [...a.tiles, ...b.tiles]) {
    const k = `${t.x},${t.y}`;
    if (!seen.has(k)) {
      seen.add(k);
      union.push(t);
    }
  }
  // Sort by physical position (ascending) so the text reads left-to-right or top-to-bottom.
  if (aIsHorizontal) {
    union.sort((p, q) => p.x - q.x);
  } else {
    union.sort((p, q) => p.y - q.y);
  }
  return union.map((t) => board[t.y][t.x]).join("").normalize("NFC").toLowerCase();
}

/**
 * Returns true when `candidate` starts later in reading order than `other`
 * (i.e. candidate is the suffix / tail word in the overlap).
 */
function startsLater(candidate: BoardWord, other: BoardWord): boolean {
  if (candidate.direction === other.direction) {
    switch (candidate.direction) {
      case "right": return candidate.start.x > other.start.x;
      case "left":  return candidate.start.x < other.start.x;
      case "down":  return candidate.start.y > other.start.y;
      case "up":    return candidate.start.y < other.start.y;
      default: return false;
    }
  }
  // Cross-direction on the same axis: compare physical minimum coordinate.
  const candIsHorizontal = candidate.direction === "right" || candidate.direction === "left";
  if (candIsHorizontal) {
    const candMinX = Math.min(...candidate.tiles.map((t) => t.x));
    const otherMinX = Math.min(...other.tiles.map((t) => t.x));
    return candMinX > otherMinX;
  }
  const candMinY = Math.min(...candidate.tiles.map((t) => t.y));
  const otherMinY = Math.min(...other.tiles.map((t) => t.y));
  return candMinY > otherMinY;
}

/**
 * Remove words that suffix-overlap another word in the same candidate list
 * such that their union span is not a dictionary word.
 *
 * Example: "klasa" (y=0..4) and "sax" (y=3..5) share tiles S,A.
 * Union "klasax" ∉ dict → "sax" (later-starting) is suppressed.
 *
 * If the union IS in the dictionary, `removeSubwords` already handles it
 * (both shorter words are strict sub-words of the longer combined word).
 */
function removeSuffixOverlaps<T extends BoardWord>(
  words: T[],
  board: BoardGrid,
  dictionary: Set<string>,
): T[] {
  return words.filter((candidate) => {
    const candIsHorizontal = candidate.direction === "right" || candidate.direction === "left";
    for (const other of words) {
      if (other === candidate) continue;
      const otherIsHorizontal = other.direction === "right" || other.direction === "left";
      // Only compare words on the same axis (both horizontal or both vertical).
      if (candIsHorizontal !== otherIsHorizontal) continue;
      if (!startsLater(candidate, other)) continue;

      const otherKeys = new Set(other.tiles.map((t) => `${t.x},${t.y}`));
      const hasOverlap = candidate.tiles.some((t) => otherKeys.has(`${t.x},${t.y}`));
      if (!hasOverlap) continue;

      const combined = buildUnionText(candidate, other, board);
      if (combined === null) continue;
      const combinedReversed = [...combined].reverse().join("");
      if (!dictionary.has(combined) && !dictionary.has(combinedReversed)) return false;
    }
    return true;
  });
}

/**
 * Return the set of "x,y" keys for tiles in `word` that are frozen by the opponent.
 * Tiles owned by "both" are NOT included — both players may score through them freely.
 */
function getOpponentFrozenKeys(
  word: BoardWord,
  frozenTiles: FrozenTileMap,
  playerSlot: "player_a" | "player_b",
): Set<string> {
  const opponentSlot =
    playerSlot === "player_a" ? "player_b" : "player_a";
  const keys = new Set<string>();

  for (const tile of word.tiles) {
    const key = `${tile.x},${tile.y}`;
    const frozen = frozenTiles[key];
    if (frozen?.owner === opponentSlot) {
      keys.add(key);
    }
  }
  return keys;
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

  // Build a set of frozen tile positions — only these can cause cross-word violations.
  const frozenTileSet = new Set(Object.keys(frozenTiles));

  // Helper to filter, cross-word-validate, and attribute words.
  // `board` is the board state at the point the words were found.
  // `extraTileSet` adds same-round opponent tile positions to the established-tile
  // set used for cross-word checking (see hasCrossWordViolation).
  const filterAndAttribute = (
    words: BoardWord[],
    excludeKeys: Set<string>,
    pId: string,
    playerSlot: "player_a" | "player_b",
    board: BoardGrid,
    extraTileSet: Set<string> = new Set(),
  ): AttributedWord[] => {
    // Phase 1: collect candidates that pass per-word checks.
    const candidates: AttributedWord[] = [];
    for (const word of words) {
      // Only orthogonal directions (right, left, down, up) — no diagonals
      if (
        word.direction !== "right" &&
        word.direction !== "left" &&
        word.direction !== "down" &&
        word.direction !== "up"
      ) continue;
      if (excludeKeys.has(wordKey(word))) continue;
      if (reportedKeys.has(wordKey(word))) continue;
      if (hasCrossWordViolation(board, word, frozenTileSet, dictionary, extraTileSet)) continue;
      if (hasInlineExtensionViolation(board, word, frozenTileSet, dictionary, extraTileSet)) continue;
      const opponentFrozenKeys = getOpponentFrozenKeys(word, frozenTiles, playerSlot);
      candidates.push({ ...word, playerId: pId, opponentFrozenKeys });
    }

    // Phase 2: suppress sub-words — only the longest word in each tile run scores.
    const accepted = removeSubwords(candidates);

    // Phase 2a: suppress suffix-prefix overlaps — when two words share tiles at a
    // suffix/prefix boundary and their union is not a dictionary word, keep only
    // the earlier-starting word.
    const overlapFiltered = removeSuffixOverlaps(accepted, board, dictionary);

    // Phase 2.5: cross-validate same-round words against each other.
    // A word is invalid if any tile it contains, together with an adjacent tile
    // from another accepted same-round word, forms an invalid cross-sequence.
    // This catches adjacent parallel words (e.g. two vertical words side-by-side)
    // that produce invalid horizontal junctions between them.
    const crossValidated = overlapFiltered.filter((word) => {
      const otherTiles = new Set<string>(extraTileSet);
      for (const other of overlapFiltered) {
        if (other === word) continue;
        for (const tile of other.tiles) {
          otherTiles.add(`${tile.x},${tile.y}`);
        }
      }
      return !hasCrossWordViolation(board, word, frozenTileSet, dictionary, otherTiles);
    });

    // Phase 3: register and return.
    for (const w of crossValidated) {
      reportedKeys.add(wordKey(w));
      result.push(w);
    }
    return crossValidated;
  };

  // Player A: new words in intermediate that weren't in baseline
  const playerAWords = filterAndAttribute(
    intermediate.words,
    baselineKeys,
    playerAId,
    "player_a",
    boardA,
  );

  // Build the set of tile positions belonging to Player A's newly credited words.
  // These are "established" for Player B's cross-word checks this round.
  const playerATileSet = new Set<string>(
    playerAWords.flatMap((w) => w.tiles.map((t) => `${t.x},${t.y}`)),
  );

  // Player B: new words in final that weren't in intermediate
  filterAndAttribute(
    final.words,
    intermediateKeys,
    playerBId,
    "player_b",
    boardAfter,
    playerATileSet,
  );

  return result;
}
