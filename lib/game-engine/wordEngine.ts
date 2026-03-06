import type { BoardGrid, BoardWord, Coordinate } from "@/lib/types/board";
import type {
  AcceptedMove,
  FrozenTileMap,
  WordScoreBreakdown,
  RoundScoreResult,
} from "@/lib/types/match";
import { logPlaytestInfo } from "@/lib/observability/log";
import { loadDictionary } from "./dictionary";
import { applySwap } from "./board";
import { scanFromSwapCoordinates } from "./boardScanner";
import { selectOptimalCombination } from "./crossValidator";
import {
  calculateLetterPoints,
  calculateLengthBonus,
} from "./scorer";
import { freezeTiles } from "./frozenTiles";

/**
 * Score a list of BoardWords for a player using the PRD formula.
 *
 * For each word:
 *   lettersPoints = sum(letter_values) — excluding opponent-frozen tiles
 *   lengthBonus = (word_length - 2) * 5
 *   total = lettersPoints + lengthBonus
 */
function scoreBoardWords(
  words: BoardWord[],
  playerId: string,
  frozenTiles: FrozenTileMap,
  playerSlot: "player_a" | "player_b",
): WordScoreBreakdown[] {
  const opponentSlot =
    playerSlot === "player_a" ? "player_b" : "player_a";

  return words.map((word) => {
    const ownLetters = word.tiles
      .map((t, i) => {
        const key = `${t.x},${t.y}`;
        const frozen = frozenTiles[key];
        return frozen?.owner === opponentSlot ? "" : word.text[i];
      })
      .join("");
    const lettersPoints = calculateLetterPoints(ownLetters);
    const lengthBonus = calculateLengthBonus(word.length);
    const totalPoints = lettersPoints + lengthBonus;

    return {
      word: word.text,
      length: word.length,
      lettersPoints,
      lengthBonus,
      totalPoints,
      tiles: word.tiles,
      playerId,
    };
  });
}

/**
 * Compute score deltas from breakdowns, grouped by player.
 */
function computeDeltas(
  breakdowns: WordScoreBreakdown[],
  playerAId: string,
): { playerA: number; playerB: number } {
  let playerATotal = 0;
  let playerBTotal = 0;

  for (const bd of breakdowns) {
    if (bd.playerId === playerAId) {
      playerATotal += bd.totalPoints;
    } else {
      playerBTotal += bd.totalPoints;
    }
  }

  return { playerA: playerATotal, playerB: playerBTotal };
}

/**
 * Create an empty RoundScoreResult for zero-word rounds.
 */
function emptyRoundScoreResult(
  durationMs: number,
  frozenTiles: FrozenTileMap,
): RoundScoreResult {
  return {
    playerAWords: [],
    playerBWords: [],
    deltas: { playerA: 0, playerB: 0 },
    newFrozenTiles: frozenTiles,
    wasPartialFreeze: false,
    durationMs,
  };
}

/**
 * Get the swap coordinates from an AcceptedMove.
 */
function getSwapCoordinates(move: AcceptedMove): Coordinate[] {
  return [
    { x: move.fromX, y: move.fromY },
    { x: move.toX, y: move.toY },
  ];
}

/**
 * Sort accepted moves by submittedAt ascending. If timestamps are
 * identical, player_a gets precedence (deterministic tiebreaker).
 */
function sortByPrecedence(
  moves: AcceptedMove[],
  playerAId: string,
): AcceptedMove[] {
  return [...moves].sort((a, b) => {
    const aTime = a.submittedAt ?? "";
    const bTime = b.submittedAt ?? "";
    if (aTime < bTime) return -1;
    if (aTime > bTime) return 1;
    // Tiebreaker: player_a first
    if (a.playerId === playerAId) return -1;
    if (b.playerId === playerAId) return 1;
    return 0;
  });
}

/**
 * Process a single player's move: apply swap → scan → cross-validate → score → freeze.
 */
function processPlayerMove(
  board: BoardGrid,
  move: AcceptedMove,
  frozenTiles: FrozenTileMap,
  dictionary: Set<string>,
  playerSlot: "player_a" | "player_b",
  playerAId: string,
  playerBId: string,
): {
  breakdowns: WordScoreBreakdown[];
  updatedFrozenTiles: FrozenTileMap;
  boardAfterSwap: BoardGrid;
  wasPartialFreeze: boolean;
} {
  // Apply swap
  const boardAfterSwap = applySwap(board, {
    from: { x: move.fromX, y: move.fromY },
    to: { x: move.toX, y: move.toY },
  });

  // Scan for words from swap coordinates
  const swapCoords = getSwapCoordinates(move);
  const candidates = scanFromSwapCoordinates(
    boardAfterSwap,
    swapCoords,
    dictionary,
  );

  // Cross-validate and select optimal combination
  const validWords = selectOptimalCombination(
    candidates,
    boardAfterSwap,
    frozenTiles,
    dictionary,
    playerSlot,
  );

  // Score the valid words
  const breakdowns = scoreBoardWords(
    validWords,
    move.playerId,
    frozenTiles,
    playerSlot,
  );

  // Freeze tiles from scored words
  const freezeResult = freezeTiles({
    scoredWords: breakdowns,
    existingFrozenTiles: frozenTiles,
    playerAId,
    playerBId,
  });

  return {
    breakdowns,
    updatedFrozenTiles: freezeResult.updatedFrozenTiles,
    boardAfterSwap,
    wasPartialFreeze: freezeResult.wasPartialFreeze,
  };
}

/**
 * Top-level orchestrator for word finding, scoring, and freezing.
 *
 * Pipeline (FR-005, FR-006, FR-007):
 * 1. Sort moves by submittedAt ascending (first submitter has precedence)
 * 2. Process first submitter: apply swap → scan → cross-validate → score → freeze
 * 3. Process second submitter: apply swap on updated board →
 *    scan → cross-validate (with updated frozen tiles) → score → freeze
 *
 * @performance MUST complete in <50ms total
 */
export async function processRoundScoring(params: {
  matchId: string;
  roundId: string;
  roundNumber?: number;
  boardBefore: BoardGrid;
  acceptedMoves: AcceptedMove[];
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
}): Promise<RoundScoreResult> {
  const start = performance.now();

  // Zero-accepted-moves guard
  if (params.acceptedMoves.length === 0) {
    const durationMs = performance.now() - start;
    logPlaytestInfo("word-engine.scoring", {
      matchId: params.matchId,
      roundNumber: params.roundNumber,
      metadata: {
        roundId: params.roundId,
        durationMs: Math.round(durationMs),
        wordsFound: 0,
        wordsScored: 0,
        tilesFrozen: 0,
      },
    });
    return emptyRoundScoreResult(durationMs, params.frozenTiles);
  }

  const dictionary = await loadDictionary();

  // Sort by submission time (FR-005)
  const sortedMoves = sortByPrecedence(
    params.acceptedMoves,
    params.playerAId,
  );

  const allBreakdowns: WordScoreBreakdown[] = [];
  let currentBoard = params.boardBefore;
  let currentFrozenTiles = params.frozenTiles;
  let wasPartialFreeze = false;

  // Process each player sequentially (FR-006, FR-007)
  for (const move of sortedMoves) {
    const playerSlot =
      move.playerId === params.playerAId
        ? "player_a"
        : "player_b";

    const result = processPlayerMove(
      currentBoard,
      move,
      currentFrozenTiles,
      dictionary,
      playerSlot,
      params.playerAId,
      params.playerBId,
    );

    allBreakdowns.push(...result.breakdowns);
    currentBoard = result.boardAfterSwap;
    currentFrozenTiles = result.updatedFrozenTiles;
    if (result.wasPartialFreeze) wasPartialFreeze = true;
  }

  const playerAWords = allBreakdowns.filter(
    (b) => b.playerId === params.playerAId,
  );
  const playerBWords = allBreakdowns.filter(
    (b) => b.playerId === params.playerBId,
  );

  const deltas = computeDeltas(allBreakdowns, params.playerAId);
  const durationMs = performance.now() - start;

  const tilesFrozen = Object.keys(currentFrozenTiles).length;

  logPlaytestInfo("word-engine.scoring", {
    matchId: params.matchId,
    roundNumber: params.roundNumber,
    metadata: {
      roundId: params.roundId,
      durationMs: Math.round(durationMs),
      wordsFound: allBreakdowns.length,
      wordsScored: allBreakdowns.length,
      tilesFrozen,
      wasPartialFreeze,
    },
  });

  return {
    playerAWords,
    playerBWords,
    deltas,
    newFrozenTiles: currentFrozenTiles,
    wasPartialFreeze,
    durationMs,
  };
}
