import type { BoardGrid } from "@/lib/types/board";
import type {
  FrozenTileMap,
  WordScoreBreakdown,
  RoundScoreResult,
} from "@/lib/types/match";
import { logPlaytestInfo } from "@/lib/observability/log";
import { loadDictionary } from "./dictionary";
import {
  detectNewWords,
  type AcceptedMove,
  type AttributedWord,
} from "./deltaDetector";
import {
  calculateLetterPoints,
  calculateLengthBonus,
} from "./scorer";
import { freezeTiles } from "./frozenTiles";

/**
 * Score a list of attributed words using the PRD formula.
 *
 * For each word:
 *   base = sum(letter_values) — excluding opponent-frozen tiles
 *   lengthBonus = (length - 2) * 5
 *   total = base + lengthBonus
 */
function scoreAttributedWords(
  words: AttributedWord[],
): WordScoreBreakdown[] {
  return words.map((word) => {
    // Score only the letters contributed by this player (not opponent-frozen tiles).
    // Length bonus uses the full word length regardless of tile ownership.
    const ownLetters = word.tiles
      .map((t, i) =>
        word.opponentFrozenKeys.has(`${t.x},${t.y}`) ? "" : word.text[i],
      )
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
      playerId: word.playerId,
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
 * Top-level orchestrator for word finding, scoring, and freezing.
 *
 * Pipeline: loadDictionary → detectNewWords (3 scans) → score → compute deltas
 *
 * NOTE: This function will be fully rewritten in Phase 6 (US2) to support
 * sequential player processing by submittedAt timestamp. For now it preserves
 * the existing three-scan approach but without combo bonus or duplicate tracking.
 *
 * @performance MUST complete in <50ms total (FR-021)
 */

/**
 * Helper function to check if two boards are identical (tile-by-tile comparison).
 */
function areBoardsIdentical(
  board1: BoardGrid,
  board2: BoardGrid,
): boolean {
  for (let y = 0; y < board1.length; y++) {
    for (let x = 0; x < board1[y].length; x++) {
      if (board1[y][x] !== board2[y][x]) {
        return false;
      }
    }
  }
  return true;
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

export async function processRoundScoring(params: {
  matchId: string;
  roundId: string;
  /** Round number (1-based) for observability logging. */
  roundNumber?: number;
  boardBefore: BoardGrid;
  boardAfter: BoardGrid;
  acceptedMoves: AcceptedMove[];
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
}): Promise<RoundScoreResult> {
  const start = performance.now();
  const startMark = "word-engine:start";
  const endMark = "word-engine:end";
  performance.mark(startMark);

  // FR-006d: Zero-accepted-moves guard
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

  // FR-006e: Board-unchanged short-circuit
  if (areBoardsIdentical(params.boardBefore, params.boardAfter)) {
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
  performance.mark("word-engine:dict-loaded");

  const newWords = detectNewWords({
    boardBefore: params.boardBefore,
    boardAfter: params.boardAfter,
    dictionary,
    acceptedMoves: params.acceptedMoves,
    frozenTiles: params.frozenTiles,
    playerAId: params.playerAId,
    playerBId: params.playerBId,
  });
  performance.mark("word-engine:delta-done");

  const breakdowns = scoreAttributedWords(newWords);

  const playerAWords = breakdowns.filter(
    (b) => b.playerId === params.playerAId,
  );
  const playerBWords = breakdowns.filter(
    (b) => b.playerId === params.playerBId,
  );
  performance.mark("word-engine:scored");

  const deltas = computeDeltas(breakdowns, params.playerAId);

  performance.mark("word-engine:freeze-start");
  const freezeResult = freezeTiles({
    scoredWords: breakdowns,
    existingFrozenTiles: params.frozenTiles,
    playerAId: params.playerAId,
    playerBId: params.playerBId,
  });
  performance.mark("word-engine:freeze-done");
  performance.mark(endMark);

  const durationMs = performance.now() - start;
  performance.measure("word-engine:total", startMark, endMark);
  const computeDurationMs = performance.measure(
    "word-engine:compute",
    "word-engine:dict-loaded",
    "word-engine:scored",
  ).duration;

  const wordsFound = newWords.length;
  const wordsScored = breakdowns.length;
  const tilesFrozen = Object.keys(freezeResult.updatedFrozenTiles).length;

  logPlaytestInfo("word-engine.scoring", {
    matchId: params.matchId,
    roundNumber: params.roundNumber,
    metadata: {
      roundId: params.roundId,
      durationMs: Math.round(durationMs),
      computeDurationMs: Math.round(computeDurationMs),
      wordsFound,
      wordsScored,
      tilesFrozen,
      wasPartialFreeze: freezeResult.wasPartialFreeze,
    },
  });

  return {
    playerAWords,
    playerBWords,
    deltas,
    newFrozenTiles: freezeResult.updatedFrozenTiles,
    wasPartialFreeze: freezeResult.wasPartialFreeze,
    durationMs,
  };
}
