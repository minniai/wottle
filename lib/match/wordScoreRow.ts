import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import type { Coordinate } from "@/lib/types/board";
import type { WordScore } from "@/lib/types/match";

/** Shape of a `word_score_entries` row as read by every loader. */
export interface WordScoreEntryRow {
  player_id: string;
  word: string;
  length: number;
  letters_points: number;
  bonus_points: number;
  total_points: number;
  tiles: Coordinate[] | null;
}

/**
 * The single row → `WordScore` mapper. `tiles` is stored in reading order, so
 * the reading direction is derived here rather than persisted (spec 044, R1).
 */
export function mapWordScoreRow(row: WordScoreEntryRow): WordScore {
  const coordinates = row.tiles ?? [];
  return {
    playerId: row.player_id,
    word: row.word,
    length: row.length,
    lettersPoints: row.letters_points,
    bonusPoints: row.bonus_points,
    totalPoints: row.total_points,
    coordinates,
    direction: tryDeriveReadingDirection(coordinates),
  };
}

export function mapWordScoreRows(rows: WordScoreEntryRow[] | null | undefined): WordScore[] {
  return (rows ?? []).map(mapWordScoreRow);
}
