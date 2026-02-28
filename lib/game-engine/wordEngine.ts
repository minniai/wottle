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
  calculateComboBonus,
} from "./scorer";
import { freezeTiles } from "./frozenTiles";

/**
 * Score a list of attributed words using the PRD formula.
 *
 * For each word:
 *   base = sum(letter_values)
 *   lengthBonus = (length - 2) * 5
 *   total = base + lengthBonus (0 if duplicate)
 *
 * When priorScoredWordsByPlayer is provided, words already scored
 * by that player in a prior round are marked isDuplicate and get 0 points.
 */
function scoreAttributedWords(
  words: AttributedWord[],
  priorScoredWordsByPlayer?: Record<string, Set<string>>,
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
    const normalizedWord = word.text.toLowerCase();
    const playerSet = priorScoredWordsByPlayer?.[word.playerId];
    const isDuplicate = playerSet?.has(normalizedWord) ?? false;
    const totalPoints = isDuplicate ? 0 : lettersPoints + lengthBonus;

    return {
      word: word.text,
      length: word.length,
      lettersPoints,
      lengthBonus,
      totalPoints,
      isDuplicate,
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
  comboBonus: { playerA: number; playerB: number },
  playerAId: string,
): { playerA: number; playerB: number } {
  let playerATotal = comboBonus.playerA;
  let playerBTotal = comboBonus.playerB;

  for (const bd of breakdowns) {
    if (bd.isDuplicate) {
      continue;
    }
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
 * Frozen tile management is handled separately (Phase 4, US2).
 * This facade returns the scoring results; the integration layer
 * handles persistence, duplicate checking, and freeze updates.
 *
 * @performance MUST complete in <50ms total (FR-021)
 */
/** Per-player sets of words already scored in prior rounds (for duplicate detection). */
export type PriorScoredWordsByPlayer = Record<string, Set<string>>;

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
    comboBonus: { playerA: 0, playerB: 0 },
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
  /** Words each player has already scored in prior rounds (match-wide). Used to mark duplicates. */
  priorScoredWordsByPlayer?: PriorScoredWordsByPlayer;
}): Promise<RoundScoreResult> {
  const start = performance.now();
  const startMark = "word-engine:start";
  const endMark = "word-engine:end";
  performance.mark(startMark);

  // FR-006d: Zero-accepted-moves guard
  // If no moves were accepted, skip the entire pipeline
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
        duplicatesDetected: 0,
        tilesFrozen: 0,
        comboBonusA: 0,
        comboBonusB: 0,
      },
    });
    return emptyRoundScoreResult(durationMs, params.frozenTiles);
  }

  // FR-006e: Board-unchanged short-circuit
  // If the board didn't change at all, skip the entire pipeline
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
        duplicatesDetected: 0,
        tilesFrozen: 0,
        comboBonusA: 0,
        comboBonusB: 0,
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

  const breakdowns = scoreAttributedWords(
    newWords,
    params.priorScoredWordsByPlayer,
  );

  const playerAWords = breakdowns.filter(
    (b) => b.playerId === params.playerAId,
  );
  const playerBWords = breakdowns.filter(
    (b) => b.playerId === params.playerBId,
  );
  performance.mark("word-engine:scored");

  const playerANewCount = playerAWords.filter(
    (w) => !w.isDuplicate,
  ).length;
  const playerBNewCount = playerBWords.filter(
    (w) => !w.isDuplicate,
  ).length;

  const comboBonus = {
    playerA: calculateComboBonus(playerANewCount),
    playerB: calculateComboBonus(playerBNewCount),
  };

  const deltas = computeDeltas(
    breakdowns,
    comboBonus,
    params.playerAId,
  );

  performance.mark("word-engine:freeze-start");
  // Freeze tiles from scored words
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
  const wordsScored = breakdowns.filter((b) => !b.isDuplicate).length;
  const duplicatesDetected = breakdowns.filter((b) => b.isDuplicate).length;
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
      duplicatesDetected,
      tilesFrozen,
      comboBonusA: comboBonus.playerA,
      comboBonusB: comboBonus.playerB,
      wasPartialFreeze: freezeResult.wasPartialFreeze,
    },
  });

  return {
    playerAWords,
    playerBWords,
    comboBonus,
    deltas,
    newFrozenTiles: freezeResult.updatedFrozenTiles,
    wasPartialFreeze: freezeResult.wasPartialFreeze,
    durationMs,
  };
}
