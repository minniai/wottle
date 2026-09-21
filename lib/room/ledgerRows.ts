import { drawLine, finalContext, forcedDetail, incompleteDetail, NEITHER_FINISHED, RATING_PENDING, ratingSubline, verdictDetail, verdictLine } from "@/lib/constants/copy";
import { liveText, type LiveState } from "./liveLines";
import { liveLinesFor, type MoveState } from "./moveState";

export { liveText, type LiveState } from "./liveLines";
import { clockPhase, formatClock, laneFraction } from "./clock";
import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import { bandIdForWord } from "./bandGeometry";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, MatchEndedReason, PlayerSlot, ReadingDirection } from "@/lib/types/match";
import { emptyRows, type LedgerModel, type LedgerRow, type LiveLines, type SeatCell, type Territory, type Verdict, type WordCell } from "./ledgerTypes";

/** Spec 050: ten moves per player. */
export const TOTAL_MOVES = 10;

/** A scored word as accumulated on the client (spec 050): the mover's Nth move, in receipt order. */
export interface AccumulatedWord {
  playerId: string;
  /** The mover's per-player move number: the ledger row. */
  moveSeq: number;
  /** Receipt order across both players. */
  globalSeq: number;
  word: string;
  totalPoints: number;
  coordinates: Coordinate[];
  /** From the server record when present; derived from tile order otherwise. */
  direction?: ReadingDirection;
}

export const moveKeyOf = (w: Pick<AccumulatedWord, "playerId" | "moveSeq">): string => `${w.playerId}:${w.moveSeq}`;

export interface MovesPlayed {
  you: number;
  opp: number;
}

export interface BuildRowsInput {
  /** Words not yet written by the running reveal (band ids); hidden from their row until landed. */
  hiddenWordIds?: Set<string>;
  movesPlayed: MovesPlayed;
  moveLimit?: number;
  completed: boolean;
  words: AccumulatedWord[];
  playerAId: string;
  viewerSlot: PlayerSlot | null;
  live: LiveState;
  /** The viewer's beat (spec 050); when given, line 1 of the live row is the beat, line 2 the field. */
  moveState?: MoveState;
  /** The viewer's move held after its reveal before the next opens (spec 050 FR-013). */
  holdMove?: number | null;
}

function toCell(words: AccumulatedWord[]): SeatCell {
  const cells: WordCell[] = words.map((w) => ({
    word: w.word,
    points: w.totalPoints,
    coordinates: w.coordinates,
    direction: w.direction ?? tryDeriveReadingDirection(w.coordinates) ?? "ltr",
  }));
  return { words: cells, total: cells.reduce((sum, c) => sum + c.points, 0) };
}

/**
 * Ten rows indexed by move number (design system §5.4, spec 050): row N holds
 * the viewer's Nth move in their column and the opponent's Nth in theirs, so
 * the columns fill at their own pace. A resolved move with no word is a `0`
 * cell; an unplayed move is empty. The live row is the viewer's next open
 * move; during the hold it is the move just scored.
 */
export function buildLedgerRows(input: BuildRowsInput): LedgerRow[] {
  const limit = input.moveLimit ?? TOTAL_MOVES;
  const seatOf = (playerId: string): Seat =>
    seatForSlot(input.viewerSlot, playerId === input.playerAId ? "player_a" : "player_b");
  const visible = input.words.filter((w) => !input.hiddenWordIds?.has(bandIdForWord(w) ?? ""));
  const cellFor = (seat: Seat, move: number): SeatCell | null => {
    const played = seat === "you" ? input.movesPlayed.you : input.movesPlayed.opp;
    if (move > played) return null;
    return toCell(visible.filter((w) => seatOf(w.playerId) === seat && w.moveSeq === move));
  };
  const holding = input.holdMove != null;
  const liveMove = holding ? null : Math.min(input.movesPlayed.you + 1, limit);
  const lines = input.moveState ? liveLinesFor(input.moveState, input.live) : liveText(input.live);
  return emptyRows(limit).map((row) => {
    const cells = { you: cellFor("you", row.move), opp: cellFor("opp", row.move) };
    if (!input.completed && holding && row.move === input.holdMove) return { ...row, ...cells, status: "settled", live: lines };
    if (!input.completed && row.move === liveMove) return { ...row, ...cells, status: "live", live: lines };
    if (cells.you || cells.opp) return { ...row, ...cells, status: "past" };
    return row;
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
  /** The shared clock as the client reads it; the ledger clock draws it once (spec 050 FR-015). */
  clockMs?: number;
  /** This match's clock length (5:00 unless a playtest shortens it); the bar drains over it. */
  clockLengthMs?: number;
  /** Match-level lines only; the field's instruction lives on the live row. Empty hides the line. */
  hint?: string;
}

/**
 * The ledger is the match's (2026-09-21): during a match its caption names no
 * move of the viewer's (the bottom bar counts those); the final caption is set
 * by the caller.
 */
export function buildMatchLedger(input: BuildLedgerInput): LedgerModel {
  return {
    caption: "",
    clock: input.clockMs === undefined ? undefined : formatClock(input.clockMs),
    clockPhase: input.clockMs === undefined ? undefined : clockPhase(input.clockMs),
    clockFraction: input.clockMs === undefined ? undefined : laneFraction(input.clockMs, input.clockLengthMs),
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
  const pastMoves = rows.filter((r) => r.status === "past").map((r) => r.move);
  const keep = new Set(pastMoves.slice(-KEEP_UNFOLDED));
  return rows.map((r) => (r.status === "past" && !keep.has(r.move) ? { ...r, folded: true } : r));
}

export interface VerdictInput {
  viewerName: string;
  opponentName: string;
  viewerScore: number;
  opponentScore: number;
  viewerWords: number;
  opponentWords: number;
  viewerMoves: number;
  opponentMoves: number;
  territory: Territory;
  /** The seat the server recorded as the winner, when the totals do not name them (spec 048). */
  winnerSeat?: Seat | null;
  endedReason?: MatchEndedReason | null;
}

/** A win the totals do not explain: the detail line says what ended the match instead. */
const FORCED: Record<string, "forfeit" | "disconnect"> = { forfeit: "forfeit", disconnect: "disconnect", abandoned: "disconnect" };

/**
 * `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25` —
 * stated once, same voice for win and loss. A default result (spec 050) says
 * the count that decided it: `Kári played 8 of 10`, `neither finished`.
 */
export function buildVerdict(v: VerdictInput): Verdict {
  const winnerSeat =
    v.endedReason === "both_incomplete" ? null : (v.winnerSeat ?? (v.viewerScore === v.opponentScore ? null : v.viewerScore > v.opponentScore ? "you" : "opp"));
  const youWin = winnerSeat === "you";
  const [hi, lo] = youWin ? [v.viewerScore, v.opponentScore] : [v.opponentScore, v.viewerScore];
  const [wordsHi, wordsLo] = youWin ? [v.viewerWords, v.opponentWords] : [v.opponentWords, v.viewerWords];
  const [terrHi, terrLo] = youWin ? [v.territory.you, v.territory.opp] : [v.territory.opp, v.territory.you];
  const loserName = youWin ? v.opponentName : v.viewerName;
  const loserMoves = youWin ? v.opponentMoves : v.viewerMoves;
  const forced = v.endedReason ? FORCED[v.endedReason] : undefined;
  const detailLine =
    v.endedReason === "both_incomplete"
      ? NEITHER_FINISHED
      : v.endedReason === "incomplete" && winnerSeat !== null
        ? incompleteDetail(loserName, loserMoves)
        : forced && winnerSeat !== null
          ? forcedDetail(loserName, forced)
          : verdictDetail(hi - lo, wordsHi, wordsLo, terrHi, terrLo);
  return {
    winnerSeat,
    scoreLine: winnerSeat === null ? drawLine(v.viewerScore, v.opponentScore) : verdictLine(youWin ? v.viewerName : v.opponentName, hi, lo),
    detailLine,
  };
}

export interface RatingRow {
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
}

/** `1191 → 1203 · +12 · wins` for the final bars (design system §5.3); `rating pending` until the row is written. */
export function ratingLine(rows: RatingRow[] | null, playerId: string, winnerSeatIsThis: boolean): string {
  const row = rows?.find((r) => r.playerId === playerId);
  if (!row) return RATING_PENDING;
  return ratingSubline(row.ratingBefore, row.ratingAfter, row.ratingDelta, winnerSeatIsThis);
}

/** `final · 4:52` — how long the match ran. */
export function finalCaption(durationMs: number): string {
  return finalContext(formatClock(Math.max(0, durationMs)));
}
