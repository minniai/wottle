/**
 * Word Engine & Scoring — Internal API Contracts
 *
 * These interfaces define the contracts between modules in the word engine
 * pipeline. They are NOT runtime types — they document the expected signatures
 * and data shapes for implementation.
 *
 * Runtime types are defined in lib/types/board.ts and lib/types/match.ts.
 *
 * @feature 003-word-engine-scoring
 */

import type { BoardGrid, Coordinate } from "@/lib/types/board";

// ─── Direction & Board Word ───────────────────────────────────────────

export type Direction =
  | "right"
  | "left"
  | "down"
  | "up"
  | "down-right"
  | "down-left"
  | "up-right"
  | "up-left";

export interface BoardWord {
  /** NFC-normalized, lowercased word text */
  text: string;
  /** Original-case text for UI display */
  displayText: string;
  /** Direction the word reads on the board */
  direction: Direction;
  /** Starting coordinate of the word */
  start: Coordinate;
  /** Number of letters */
  length: number;
  /** Ordered coordinates of each letter */
  tiles: Coordinate[];
}

// ─── Frozen Tiles ─────────────────────────────────────────────────────

export type FrozenTileOwner = "player_a" | "player_b" | "both";

export interface FrozenTile {
  owner: FrozenTileOwner;
}

/** Keys are "x,y" coordinate strings */
export type FrozenTileMap = Record<string, FrozenTile>;

// ─── Dictionary ───────────────────────────────────────────────────────

/**
 * Load the Icelandic dictionary into memory.
 * Returns a cached singleton Set on subsequent calls.
 *
 * @returns Set of NFC-normalized, lowercased valid Icelandic words
 * @throws if the dictionary file cannot be read
 * @performance MUST complete in <200ms on cold start (FR-022)
 *
 * Module: lib/game-engine/dictionary.ts
 */
export interface DictionaryContract {
  loadDictionary(): Promise<Set<string>>;
  lookupWord(dictionary: Set<string>, word: string): boolean;
}

// ─── Board Scanner ────────────────────────────────────────────────────

export interface ScanResult {
  /** All valid words found on the board */
  words: BoardWord[];
  /** Duration of the scan in milliseconds */
  durationMs: number;
}

/**
 * Scan a board in all 8 directions for valid dictionary words.
 *
 * @param board - 10×10 grid of letters
 * @param dictionary - Set of valid words
 * @returns All valid words found with their coordinates
 * @performance MUST complete in <10ms for a 10×10 board
 *
 * Module: lib/game-engine/boardScanner.ts
 */
export interface BoardScannerContract {
  scanBoard(board: BoardGrid, dictionary: Set<string>): ScanResult;
}

// ─── Delta Detector ───────────────────────────────────────────────────

export interface AttributedWord extends BoardWord {
  /** Which player's swap created this word */
  playerId: string;
}

/**
 * Detect newly formed words by comparing board states.
 * Attributes each new word to the player whose swap created it.
 *
 * @param boardBefore - Board state before any swaps
 * @param boardAfter - Board state after all swaps applied
 * @param dictionary - Set of valid words
 * @param acceptedMoves - Ordered list of accepted moves (Player A first)
 * @param frozenTiles - Current frozen tile map for ownership filtering
 * @param playerAId - Player A's UUID
 * @param playerBId - Player B's UUID
 * @returns New words attributed to their creating player
 *
 * Module: lib/game-engine/deltaDetector.ts
 */
export interface DeltaDetectorContract {
  detectNewWords(params: {
    boardBefore: BoardGrid;
    boardAfter: BoardGrid;
    dictionary: Set<string>;
    acceptedMoves: AcceptedMove[];
    frozenTiles: FrozenTileMap;
    playerAId: string;
    playerBId: string;
  }): AttributedWord[];
}

export interface AcceptedMove {
  playerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// ─── Scorer ───────────────────────────────────────────────────────────

export interface WordScoreBreakdown {
  word: string;
  length: number;
  /** Sum of LETTER_SCORING_VALUES_IS for each character */
  lettersPoints: number;
  /** (word_length - 2) * 5 */
  lengthBonus: number;
  /** lettersPoints + lengthBonus (0 if duplicate) */
  totalPoints: number;
  /** True if word was scored by this player in a prior round */
  isDuplicate: boolean;
  tiles: Coordinate[];
  playerId: string;
}

export interface ComboBonus {
  playerA: number;
  playerB: number;
}

/**
 * Calculate scores for attributed words using the PRD formula.
 *
 * @param words - New words attributed to players
 * @param matchId - For checking previously scored words
 * @returns Per-word score breakdowns and combo bonuses
 *
 * Scoring formula:
 *   base = sum(letter_values)
 *   lengthBonus = (length - 2) * 5
 *   total = base + lengthBonus (0 if duplicate)
 *   combo: 1→+0, 2→+2, 3→+5, 4+→+7+(n-4)
 *
 * Module: lib/game-engine/scorer.ts
 */
export interface ScorerContract {
  scoreWords(params: {
    words: AttributedWord[];
    matchId: string;
    playerAId: string;
    playerBId: string;
  }): Promise<{
    breakdowns: WordScoreBreakdown[];
    comboBonus: ComboBonus;
  }>;

  calculateLetterPoints(word: string): number;
  calculateLengthBonus(wordLength: number): number;
  calculateComboBonus(newWordCount: number): number;
}

// ─── Frozen Tile Manager ──────────────────────────────────────────────

export interface FreezeResult {
  /** Updated frozen tile map (merged with existing) */
  updatedFrozenTiles: FrozenTileMap;
  /** Tiles that were newly frozen this round */
  newlyFrozen: Coordinate[];
  /** True if the 24-unfrozen minimum prevented full freezing */
  wasPartialFreeze: boolean;
  /** Number of unfrozen tiles remaining after freeze */
  unfrozenRemaining: number;
}

/**
 * Manage frozen tile state for a match.
 *
 * @performance O(n) where n = number of tiles in scored words
 *
 * Module: lib/game-engine/frozenTiles.ts
 */
export interface FrozenTileManagerContract {
  /** Freeze tiles from scored words, respecting 24-unfrozen minimum */
  freezeTiles(params: {
    scoredWords: WordScoreBreakdown[];
    existingFrozenTiles: FrozenTileMap;
    playerAId: string;
    playerBId: string;
    boardSize?: number;
  }): FreezeResult;

  /** Check if a coordinate is frozen */
  isFrozen(frozenTiles: FrozenTileMap, coordinate: Coordinate): boolean;

  /** Check if a coordinate is frozen by a specific player's opponent */
  isFrozenByOpponent(
    frozenTiles: FrozenTileMap,
    coordinate: Coordinate,
    playerSlot: "player_a" | "player_b",
  ): boolean;

  /** Build coordinate key for frozen tile map lookups */
  toFrozenKey(coordinate: Coordinate): string;
}

// ─── Word Engine Facade ───────────────────────────────────────────────

export interface RoundScoreResult {
  /** Per-word breakdowns for both players */
  breakdowns: WordScoreBreakdown[];
  /** Combo bonuses per player */
  comboBonus: ComboBonus;
  /** Updated frozen tile map */
  frozenTiles: FrozenTileMap;
  /** Tiles newly frozen this round */
  newlyFrozenTiles: Coordinate[];
  /** Score deltas for this round */
  deltas: { playerA: number; playerB: number };
  /** Was partial freeze applied (24-tile minimum) */
  wasPartialFreeze: boolean;
  /** Total pipeline duration in milliseconds */
  durationMs: number;
}

/**
 * Top-level orchestrator for word finding, scoring, and freezing.
 * Called by computeWordScoresForRound() in the round resolution flow.
 *
 * Pipeline: scan → delta → attribute → score → freeze
 *
 * @performance MUST complete in <50ms total (FR-021)
 *
 * Module: lib/game-engine/wordEngine.ts
 */
export interface WordEngineContract {
  processRoundScoring(params: {
    matchId: string;
    roundId: string;
    boardBefore: BoardGrid;
    boardAfter: BoardGrid;
    acceptedMoves: AcceptedMove[];
    frozenTiles: FrozenTileMap;
    playerAId: string;
    playerBId: string;
  }): Promise<RoundScoreResult>;
}
