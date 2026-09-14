import { PLAYED, picking, roundContext, TAP_SECOND_LETTER } from "@/lib/constants/copy";
import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot, ReadingDirection } from "@/lib/types/match";
import { emptyRows, type LedgerModel, type LedgerRow, type SeatCell, type Territory, type WordCell } from "./ledgerTypes";

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
