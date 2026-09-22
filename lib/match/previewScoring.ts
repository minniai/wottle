import { applySwap } from "@/lib/game-engine/board";
import { scanFromSwapCoordinates } from "@/lib/game-engine/boardScanner";
import { selectOptimalCombination } from "@/lib/game-engine/crossValidator";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import { deriveReadingDirection } from "@/lib/game-engine/readingDirection";
import { scoreBoardWords } from "@/lib/game-engine/wordEngine";
import type { BoardGrid, Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot, ReadingDirection } from "@/lib/types/match";

export interface PricedWord {
  word: string;
  points: number;
  direction: ReadingDirection;
}

export interface SwapPrice {
  words: PricedWord[];
  total: number;
}

export interface PriceSwapInput {
  board: BoardGrid;
  from: Coordinate;
  to: Coordinate;
  frozenTiles: FrozenTileMap;
  playerSlot: PlayerSlot;
  dictionary: Set<string>;
  letterValues?: Record<string, number>;
}

/**
 * Price a candidate swap with the same pipeline the engine uses at resolution
 * (apply → scan → cross-validate → score) but without freezing, persisting or
 * broadcasting anything. Pure: no I/O. Spec 044, research R2.
 */
export function priceSwap(input: PriceSwapInput): SwapPrice {
  const boardAfter = applySwap(input.board, { from: input.from, to: input.to });
  const candidates = scanFromSwapCoordinates(boardAfter, [input.from, input.to], input.dictionary);
  const accepted = selectOptimalCombination(
    candidates,
    boardAfter,
    input.frozenTiles,
    input.dictionary,
    input.playerSlot,
    input.letterValues ?? LETTER_SCORING_VALUES_IS,
  );
  const breakdowns = scoreBoardWords(
    accepted,
    "preview",
    input.frozenTiles,
    input.playerSlot,
    input.letterValues ?? LETTER_SCORING_VALUES_IS,
  );
  const words = breakdowns.map((b) => ({
    word: b.word,
    points: b.totalPoints,
    direction: deriveReadingDirection(b.tiles),
  }));
  return { words, total: words.reduce((sum, w) => sum + w.points, 0) };
}
