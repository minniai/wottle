import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import { isFrozen } from "@/lib/game-engine/frozenTiles";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot, ReadingDirection } from "@/lib/types/match";
import type { AccumulatedWord } from "./ledgerRows";

/**
 * Word bands (design system §5.2): one band per scored word record, a tint of
 * the scorer's seat colour along the word with a chevron where reading begins.
 * Geometry is in percent of the field (a 10×10 grid → one cell = 10 units).
 */
export type ChevronEdge = "left" | "right" | "top" | "bottom";

export interface BandRect {
  x: number;
  y: number;
  w: number;
  h: number;
  chevronEdge: ChevronEdge;
  axis: "horizontal" | "vertical";
}

export interface WordBand {
  id: string;
  seat: Seat;
  /** The letters this word froze first: the band's tint (spec 049 US2). */
  cells: Coordinate[];
  /** The whole word: the chevron's place and the hover's extent. */
  wordCells: Coordinate[];
  direction: ReadingDirection;
  strength: "settled" | "live";
  round: number;
  word: string;
}

const CELL = 10;
/** 20% of a cell across the short axis keeps the numeral gutter clean; 5% along the long axis never enters the neighbour. */
const SHORT_INSET = 0.2 * CELL;
const LONG_INSET = 0.05 * CELL;

const CHEVRON: Record<ReadingDirection, ChevronEdge> = { ltr: "left", rtl: "right", ttb: "top", btt: "bottom" };

export function computeBandRect(cells: Coordinate[], direction: ReadingDirection): BandRect {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const horizontal = direction === "ltr" || direction === "rtl";
  const shortInset = SHORT_INSET;
  const longInset = LONG_INSET;
  return horizontal
    ? {
        x: minX * CELL + longInset,
        y: minY * CELL + shortInset,
        w: (maxX - minX + 1) * CELL - 2 * longInset,
        h: CELL - 2 * shortInset,
        chevronEdge: CHEVRON[direction],
        axis: "horizontal",
      }
    : {
        x: minX * CELL + shortInset,
        y: minY * CELL + longInset,
        w: CELL - 2 * shortInset,
        h: (maxY - minY + 1) * CELL - 2 * longInset,
        chevronEdge: CHEVRON[direction],
        axis: "vertical",
      };
}

/** SVG path for a ~150° chevron on the reading-start edge; arm depth 9% of a cell across the band's height. */
export function chevronPath(rect: BandRect): string {
  const depth = 0.09 * CELL;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  switch (rect.chevronEdge) {
    case "left":
      return `M ${rect.x} ${rect.y} L ${rect.x + depth} ${cy} L ${rect.x} ${rect.y + rect.h}`;
    case "right":
      return `M ${rect.x + rect.w} ${rect.y} L ${rect.x + rect.w - depth} ${cy} L ${rect.x + rect.w} ${rect.y + rect.h}`;
    case "top":
      return `M ${rect.x} ${rect.y} L ${cx} ${rect.y + depth} L ${rect.x + rect.w} ${rect.y}`;
    case "bottom":
      return `M ${rect.x} ${rect.y + rect.h} L ${cx} ${rect.y + rect.h - depth} L ${rect.x + rect.w} ${rect.y + rect.h}`;
  }
}

export function bandId(word: AccumulatedWord, direction: ReadingDirection): string {
  const start = word.coordinates[0];
  return `${word.playerId}:${word.word}:${start?.x ?? "?"},${start?.y ?? "?"}:${direction}`;
}

/** Band id for an accumulated word (direction from the record or the tile order). */
export function bandIdForWord(word: AccumulatedWord): string | null {
  const direction = word.direction ?? tryDeriveReadingDirection(word.coordinates);
  return direction ? bandId(word, direction) : null;
}

export interface BandsInput {
  words: AccumulatedWord[];
  /** The field the bands are drawn over: a settled band must spell its word on it (spec 049). */
  board: string[][];
  frozenTiles: FrozenTileMap;
  viewerSlot: PlayerSlot | null;
  playerAId: string;
  /** The round being revealed: drawn at 30% from its coordinates. */
  liveRound?: number | null;
  /**
   * The most recently scored round. Its summary can reach the client a poll
   * before the snapshot that carries its freezes, so it is drawn from its
   * coordinates (settled) rather than blinking out until the freezes land.
   */
  trustRound?: number | null;
}

const isDev = process.env.NODE_ENV !== "production";

interface BandSource {
  board: string[][];
  frozenTiles: FrozenTileMap;
  /** The slot whose word this is: the band covers the cells this slot froze. */
  slot: PlayerSlot;
  trusted: boolean;
}

/**
 * The cells a word's band covers, or `null` when it must not be drawn
 * (spec 047 FR-001, review S4; spec 049). A settled word is drawn only over
 * letters that are still frozen and only when the board spells the word
 * there: on 2026-09-20 the served board was round 1's, and bands were drawn
 * over ÞKHL and GÁAAT. Of those letters it covers the ones its own seat
 * froze — a crossing keeps the earlier owner (spec 049 US2). The live round
 * and the most recently scored round keep their full run — their freezes
 * land with the reveal or the next snapshot. A word under two letters is
 * never drawn.
 */
function bandCells(w: AccumulatedWord, source: BandSource): Coordinate[] | null {
  if (w.coordinates.length < 2) return null;
  const frozen = w.coordinates.filter((c) => isFrozen(source.frozenTiles, c));
  if (!source.trusted) {
    const problem = settledProblem(w, source.board, frozen.length);
    if (problem) {
      warnOnce(`[bands] R${w.roundNumber} ${w.word}: ${problem}`);
      return null;
    }
  }
  if (source.trusted && frozen.length === 0) return w.coordinates;
  const owned = frozen.filter((c) => source.frozenTiles[`${c.x},${c.y}`]?.owner === source.slot);
  return owned.length === 0 ? null : owned;
}

const upper = (s: string): string => s.toLocaleUpperCase("is");

/** Why a settled record must not be drawn, or `null` when it may. */
function settledProblem(w: AccumulatedWord, board: string[][], frozenCount: number): string | null {
  if (frozenCount !== w.coordinates.length) return `${w.coordinates.length - frozenCount} letter(s) not frozen`;
  const expected = upper(w.word);
  if ([...expected].length !== w.coordinates.length) return `expected ${[...expected].length} coordinates, got ${w.coordinates.length}`;
  const spelled = w.coordinates.map((c) => upper(board[c.y]?.[c.x] ?? "?")).join("");
  return spelled === expected ? null : `board spells ${spelled}`;
}

/** `bandsFromWords` runs on every snapshot; a disagreeing record is reported once, not every poll. */
const warned = new Set<string>();
function warnOnce(message: string): void {
  if (!isDev || warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * Build bands from the accumulated word records. Settled words draw over their
 * frozen letters only (see `bandCells`); duplicate records collapse by id.
 */
export function bandsFromWords(input: BandsInput): WordBand[] {
  const seen = new Set<string>();
  const bands: WordBand[] = [];
  for (const w of input.words) {
    const direction = w.direction ?? tryDeriveReadingDirection(w.coordinates);
    if (!direction || w.coordinates.length === 0) continue;
    const id = bandId(w, direction);
    if (seen.has(id)) continue;
    seen.add(id);
    const live = input.liveRound != null && w.roundNumber === input.liveRound;
    const trusted = live || (input.trustRound != null && w.roundNumber === input.trustRound);
    const slot: PlayerSlot = w.playerId === input.playerAId ? "player_a" : "player_b";
    const cells = bandCells(w, { board: input.board, frozenTiles: input.frozenTiles, slot, trusted });
    if (!cells) continue;
    bands.push({
      id,
      seat: seatForSlot(input.viewerSlot, slot),
      cells,
      wordCells: w.coordinates,
      direction,
      strength: live ? "live" : "settled",
      round: w.roundNumber,
      word: w.word,
    });
  }
  return bands;
}

/**
 * The seat that colours a scored letter: the player who froze it first
 * (spec 049 US2, contracts/ownership-rendering.md). Band membership never
 * decides a cell's colour.
 */
export function ownerSeatOf(frozenTiles: FrozenTileMap, coord: Coordinate, viewerSlot: PlayerSlot | null): Seat | null {
  const owner = frozenTiles[`${coord.x},${coord.y}`]?.owner;
  return owner ? seatForSlot(viewerSlot, owner) : null;
}
