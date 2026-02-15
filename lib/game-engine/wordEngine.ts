import type { BoardGrid } from "@/lib/types/board";
import type {
  FrozenTileMap,
  WordScoreBreakdown,
  RoundScoreResult,
} from "@/lib/types/match";
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

/**
 * Score a list of attributed words using the PRD formula.
 *
 * For each word:
 *   base = sum(letter_values)
 *   lengthBonus = (length - 2) * 5
 *   total = base + lengthBonus (0 if duplicate)
 *
 * Duplicate detection is deferred — this function scores all
 * words as non-duplicate. The caller (processRoundScoring or
 * the integration layer) handles duplicate checking against
 * the word_score_entries table.
 */
function scoreAttributedWords(
  words: AttributedWord[],
): WordScoreBreakdown[] {
  return words.map((word) => {
    const lettersPoints = calculateLetterPoints(word.text);
    const lengthBonus = calculateLengthBonus(word.length);
    const totalPoints = lettersPoints + lengthBonus;

    return {
      word: word.text,
      length: word.length,
      lettersPoints,
      lengthBonus,
      totalPoints,
      isDuplicate: false,
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
export async function processRoundScoring(params: {
  matchId: string;
  roundId: string;
  boardBefore: BoardGrid;
  boardAfter: BoardGrid;
  acceptedMoves: AcceptedMove[];
  frozenTiles: FrozenTileMap;
  playerAId: string;
  playerBId: string;
}): Promise<RoundScoreResult> {
  const start = performance.now();

  const dictionary = await loadDictionary();

  const newWords = detectNewWords({
    boardBefore: params.boardBefore,
    boardAfter: params.boardAfter,
    dictionary,
    acceptedMoves: params.acceptedMoves,
    frozenTiles: params.frozenTiles,
    playerAId: params.playerAId,
    playerBId: params.playerBId,
  });

  const breakdowns = scoreAttributedWords(newWords);

  const playerAWords = breakdowns.filter(
    (b) => b.playerId === params.playerAId,
  );
  const playerBWords = breakdowns.filter(
    (b) => b.playerId === params.playerBId,
  );

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

  const durationMs = performance.now() - start;

  return {
    playerAWords,
    playerBWords,
    comboBonus,
    deltas,
    newFrozenTiles: params.frozenTiles,
    durationMs,
  };
}
