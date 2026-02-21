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
    const lettersPoints = calculateLetterPoints(word.text);
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
      wordsFound,
      wordsScored,
      duplicatesDetected,
      tilesFrozen,
      comboBonusA: comboBonus.playerA,
      comboBonusB: comboBonus.playerB,
    },
  });

  return {
    playerAWords,
    playerBWords,
    comboBonus,
    deltas,
    newFrozenTiles: freezeResult.updatedFrozenTiles,
    durationMs,
  };
}
