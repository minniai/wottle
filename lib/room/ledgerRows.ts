import { drawLine, PLAYED, picking, roundContext, TAP_SECOND_LETTER, verdictDetail, verdictLine } from "@/lib/constants/copy";
import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot, ReadingDirection } from "@/lib/types/match";
import { emptyRows, type LedgerModel, type LedgerRow, type SeatCell, type Territory, type Verdict, type WordCell } from "./ledgerTypes";

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

export type LiveState =
  | { kind: "idle" }
  | { kind: "picking"; letter: string; value: number }
  | { kind: "played" }
  | { kind: "resolving" };

export interface BuildRowsInput {
  currentRound: number;
  completed: boolean;
  words: AccumulatedWord[];
  playerAId: string;
  viewerSlot: PlayerSlot | null;
  live: LiveState;
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

export function liveText(live: LiveState): string {
  if (live.kind === "picking") return picking(live.letter, live.value);
  if (live.kind === "played") return PLAYED;
  if (live.kind === "resolving") return "resolving";
  return "";
}

/** One row per round; the current round is the live row (design system §5.4). */
export function buildLedgerRows(input: BuildRowsInput): LedgerRow[] {
  const seatOf = (playerId: string): Seat =>
    seatForSlot(input.viewerSlot, playerId === input.playerAId ? "player_a" : "player_b");
  return emptyRows(TOTAL_ROUNDS).map((row) => {
    const inRound = input.words.filter((w) => w.roundNumber === row.round);
    // Words that have already landed in the current round (instant first-mover
    // reveal, or a resolved round the server has not advanced yet) show as words.
    const landed = row.round === input.currentRound && inRound.length > 0;
    const isPast = row.round < input.currentRound || landed || (input.completed && row.round <= input.currentRound);
    const isLive = !input.completed && row.round === input.currentRound && !landed;
    if (isLive) return { ...row, status: "live", liveText: liveText(input.live) };
    if (!isPast) return row;
    return {
      ...row,
      status: "past",
      you: toCell(inRound.filter((w) => seatOf(w.playerId) === "you")),
      opp: toCell(inRound.filter((w) => seatOf(w.playerId) === "opp")),
    };
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
  hint?: string;
}

export function buildMatchLedger(input: BuildLedgerInput): LedgerModel {
  return {
    caption: roundContext(Math.min(input.currentRound, TOTAL_ROUNDS)),
    rows: buildLedgerRows(input),
    territory: buildTerritory(input.frozenTiles, input.viewerSlot),
    hint: input.hint ?? TAP_SECOND_LETTER,
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
