import { drawLine, finalContext, NO_RATING, RATING_PENDING, ratingSubline, roundContext, verdictDetail, verdictLine } from "@/lib/constants/copy";
import { liveText, type LiveState } from "./liveLines";
import { liveLinesFor, type RoundState } from "./roundState";

export { liveText, type LiveState } from "./liveLines";
import { formatClock, MATCH_CLOCK_BUDGET_MS } from "./clock";
import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import { bandIdForWord } from "./bandGeometry";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot, ReadingDirection } from "@/lib/types/match";
import { emptyRows, type LedgerModel, type LedgerRow, type LiveLines, type SeatCell, type Territory, type Verdict, type WordCell } from "./ledgerTypes";

export const TOTAL_ROUNDS = 10;

/** A scored word as accumulated on the client across rounds. */
export interface AccumulatedWord {
  roundNumber: number;
  playerId: string;
  word: string;
  totalPoints: number;
  coordinates: Coordinate[];
  isDuplicate?: boolean;
  /** From the server record when present; derived from tile order otherwise. */
  direction?: ReadingDirection;
}


export interface BuildRowsInput {
  /** Words not yet written by the running reveal (band ids); hidden from their row until landed. */
  hiddenWordIds?: Set<string>;
  currentRound: number;
  completed: boolean;
  words: AccumulatedWord[];
  playerAId: string;
  viewerSlot: PlayerSlot | null;
  live: LiveState;
  /** False for a directory challenge: the caption reads unranked. */
  rated?: boolean;
  /** The round's beat (spec 048 US2); when given, line 1 of the live row is the beat, line 2 the field. */
  roundState?: RoundState;
  /** The scored round held before the next live row opens (spec 048 FR-022). */
  holdRound?: number | null;
}

function toCell(words: AccumulatedWord[]): SeatCell | null {
  if (words.length === 0) return null;
  const cells: WordCell[] = words.map((w) => ({
    word: w.word,
    points: w.isDuplicate ? 0 : w.totalPoints,
    isDuplicate: Boolean(w.isDuplicate),
    coordinates: w.coordinates,
    direction: w.direction ?? tryDeriveReadingDirection(w.coordinates) ?? "ltr",
  }));
  return { words: cells, total: cells.reduce((sum, c) => sum + c.points, 0) };
}


/** One row per round; the current round is the live row (design system §5.4). */
export function buildLedgerRows(input: BuildRowsInput): LedgerRow[] {
  const seatOf = (playerId: string): Seat =>
    seatForSlot(input.viewerSlot, playerId === input.playerAId ? "player_a" : "player_b");
  return emptyRows(TOTAL_ROUNDS).map((row) => {
    const inRound = input.words.filter((w) => w.roundNumber === row.round && !input.hiddenWordIds?.has(bandIdForWord(w) ?? ""));
    // Words that have already landed in the current round (instant first-mover
    // reveal, or a resolved round the server has not advanced yet) show as words.
    const landed = row.round === input.currentRound && inRound.length > 0;
    const isPast = row.round < input.currentRound || landed || (input.completed && row.round <= input.currentRound);
    const holding = input.holdRound != null && input.holdRound === input.currentRound - 1;
    const isLive = !input.completed && row.round === input.currentRound && !landed && !holding;
    const lines = input.roundState ? liveLinesFor(input.roundState, input.live) : liveText(input.live);
    if (isLive) return { ...row, status: "live", live: lines };
    if (!isPast) return row;
    const cells = {
      you: toCell(inRound.filter((w) => seatOf(w.playerId) === "you")),
      opp: toCell(inRound.filter((w) => seatOf(w.playerId) === "opp")),
    };
    // The settle hold: the scored round stays the tinted row, its lines saying so (spec 048 FR-022).
    if (holding && row.round === input.holdRound) return { ...row, ...cells, status: "settled", live: lines };
    return { ...row, status: "past", ...cells };
  });
}

export function buildTerritory(frozenTiles: FrozenTileMap, viewerSlot: PlayerSlot | null): Territory {
  let you = 0;
  let opp = 0;
  for (const tile of Object.values(frozenTiles)) {
    if (seatForSlot(viewerSlot, tile.owner) === "you") you += 1;
    else opp += 1;
  }
  return { you, opp, free: 100 - you - opp };
}

export interface BuildLedgerInput extends BuildRowsInput {
  frozenTiles: FrozenTileMap;
  /** Match-level lines only; the field's instruction lives on the live row. Empty hides the line. */
  hint?: string;
}

export function buildMatchLedger(input: BuildLedgerInput): LedgerModel {
  return {
    caption: roundContext(Math.min(input.currentRound, TOTAL_ROUNDS), input.rated ?? true),
    round: Math.min(input.currentRound, TOTAL_ROUNDS),
    completed: input.completed,
    rows: buildLedgerRows(input),
    territory: buildTerritory(input.frozenTiles, input.viewerSlot),
    hint: input.hint ?? "",
  };
}

/** Rows older than the last three collapse to totals when any row would exceed three lines (design system §5.4). */
export const MAX_ROW_LINES = 3;
export const KEEP_UNFOLDED = 3;

export function foldRows(rows: LedgerRow[], lineCounts: number[]): LedgerRow[] {
  const overflow = lineCounts.some((n) => n > MAX_ROW_LINES);
  if (!overflow) return rows;
  const pastRounds = rows.filter((r) => r.status === "past").map((r) => r.round);
  const keep = new Set(pastRounds.slice(-KEEP_UNFOLDED));
  return rows.map((r) => (r.status === "past" && !keep.has(r.round) ? { ...r, folded: true } : r));
}

export interface VerdictInput {
  viewerName: string;
  opponentName: string;
  viewerScore: number;
  opponentScore: number;
  viewerWords: number;
  opponentWords: number;
  territory: Territory;
}

/** `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25` — stated once, same voice for win and loss. */
export function buildVerdict(v: VerdictInput): Verdict {
  const youWin = v.viewerScore > v.opponentScore;
  const draw = v.viewerScore === v.opponentScore;
  const winnerSeat = draw ? null : youWin ? "you" : "opp";
  const [hi, lo] = youWin ? [v.viewerScore, v.opponentScore] : [v.opponentScore, v.viewerScore];
  const [wordsHi, wordsLo] = youWin ? [v.viewerWords, v.opponentWords] : [v.opponentWords, v.viewerWords];
  const [terrHi, terrLo] = youWin ? [v.territory.you, v.territory.opp] : [v.territory.opp, v.territory.you];
  return {
    winnerSeat,
    scoreLine: draw ? drawLine(v.viewerScore, v.opponentScore) : verdictLine(youWin ? v.viewerName : v.opponentName, hi, lo),
    detailLine: verdictDetail(hi - lo, wordsHi, wordsLo, terrHi, terrLo),
  };
}

export interface RatingRow {
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
}

/**
 * `1191 → 1203 · +12 · wins` for the final bars (design system §5.3).
 *
 * An unranked match writes no rating row at all, so `rating pending` would
 * never resolve — it says what actually happened instead (spec 045 decision 1).
 */
export function ratingLine(
  rows: RatingRow[] | null,
  playerId: string,
  winnerSeatIsThis: boolean,
  rated = true,
): string {
  if (!rated) return NO_RATING;
  const row = rows?.find((r) => r.playerId === playerId);
  if (!row) return RATING_PENDING;
  return ratingSubline(row.ratingBefore, row.ratingAfter, row.ratingDelta, winnerSeatIsThis);
}

/** `ranked · 10 rounds · 18:50` — clock time both players spent. */
export function finalCaption(remainingA: number, remainingB: number, rated = true): string {
  const used = Math.max(0, 2 * MATCH_CLOCK_BUDGET_MS - remainingA - remainingB);
  return finalContext(formatClock(used), rated);
}
