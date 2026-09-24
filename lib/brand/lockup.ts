import { LETTER_SCORING_VALUES_EN } from "@/lib/game-engine/letter-values/letter_scoring_values_en";
import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";

/**
 * The marks (game flow spec §6, spec 070 FR-005): the lockup of two crossing
 * names, the strip logotype and the favicon cell. All three are the game's own
 * cells. The visitor's language reads across in `--you`; the other crosses it
 * in `--opp`; the shared letter keeps the primary word's colour and value
 * (spec 049). Each word's numerals come from its own language pack. Geometry
 * is in CSS pixels for a given cell size.
 */
export type MarkLocale = "is" | "en";
export type Seat = "you" | "opp";
export type ChevronEdge = "left" | "top";

export interface MarkCell {
  col: number;
  row: number;
  letter: string;
  seat: Seat;
  value: number;
}

export interface MarkBand {
  seat: Seat;
  x: number;
  y: number;
  w: number;
  h: number;
  chevronEdge: ChevronEdge;
}

export interface Lockup {
  cols: number;
  rows: number;
  cellPx: number;
  width: number;
  height: number;
  cells: MarkCell[];
  bands: MarkBand[];
  letterPx: number;
  numeralPx: number;
  showNumerals: boolean;
  /** Terracotta letters under 17px (cells under 31px) take the text variant. */
  oppTone: "opp" | "opp-text";
}

const ICELANDIC = "ORÐUSTA";
const ENGLISH = "WOTTLE";
const VALUES: Record<MarkLocale, Record<string, number>> = { is: LETTER_SCORING_VALUES_IS, en: LETTER_SCORING_VALUES_EN };
const NUMERALS_FROM_PX = 32;
const OPP_TEXT_BELOW_PX = 31;
const LETTER_SHARE = 0.55;
const NUMERAL_SHARE = 0.18;
const NUMERAL_MIN_PX = 9;
/** Design system §5.2: 20% of a cell across the band, 5% along it. */
const ACROSS_INSET = 0.2;
const ALONG_INSET = 0.05;

interface WordPlacement {
  word: string;
  values: MarkLocale;
  seat: Seat;
  col: number;
  row: number;
  axis: "across" | "down";
}

interface Layout {
  cols: number;
  rows: number;
  primary: WordPlacement;
  guest: WordPlacement;
}

const LAYOUTS: Record<MarkLocale, Layout> = {
  is: {
    cols: 7,
    rows: 6,
    primary: { word: ICELANDIC, values: "is", seat: "you", col: 0, row: 2, axis: "across" },
    guest: { word: ENGLISH, values: "en", seat: "opp", col: 5, row: 0, axis: "down" },
  },
  en: {
    cols: 6,
    rows: 7,
    primary: { word: ENGLISH, values: "en", seat: "you", col: 0, row: 0, axis: "across" },
    guest: { word: ICELANDIC, values: "is", seat: "opp", col: 1, row: 0, axis: "down" },
  },
};

function place(p: WordPlacement): MarkCell[] {
  return [...p.word].map((letter, i) => ({
    col: p.axis === "across" ? p.col + i : p.col,
    row: p.axis === "down" ? p.row + i : p.row,
    letter,
    seat: p.seat,
    value: VALUES[p.values][letter] ?? 0,
  }));
}

function band(p: WordPlacement, cellPx: number): MarkBand {
  const length = p.word.length * cellPx - 2 * ALONG_INSET * cellPx;
  const thickness = cellPx - 2 * ACROSS_INSET * cellPx;
  const across = p.axis === "across";
  return {
    seat: p.seat,
    x: p.col * cellPx + (across ? ALONG_INSET : ACROSS_INSET) * cellPx,
    y: p.row * cellPx + (across ? ACROSS_INSET : ALONG_INSET) * cellPx,
    w: across ? length : thickness,
    h: across ? thickness : length,
    chevronEdge: across ? "left" : "top",
  };
}

function typeScale(cellPx: number) {
  return {
    letterPx: cellPx * LETTER_SHARE,
    numeralPx: Math.max(NUMERAL_MIN_PX, cellPx * NUMERAL_SHARE),
    showNumerals: cellPx >= NUMERALS_FROM_PX,
  };
}

export function lockup(locale: MarkLocale, cellPx: number): Lockup {
  const layout = LAYOUTS[locale];
  const primary = place(layout.primary);
  const taken = new Set(primary.map((c) => `${c.col},${c.row}`));
  const guest = place(layout.guest).filter((c) => !taken.has(`${c.col},${c.row}`));
  return {
    cols: layout.cols,
    rows: layout.rows,
    cellPx,
    width: layout.cols * cellPx,
    height: layout.rows * cellPx,
    cells: [...primary, ...guest],
    bands: [band(layout.primary, cellPx), band(layout.guest, cellPx)],
    ...typeScale(cellPx),
    oppTone: cellPx < OPP_TEXT_BELOW_PX ? "opp-text" : "opp",
  };
}

export interface Strip {
  cellPx: number;
  width: number;
  height: number;
  letters: MarkCell[];
  band: MarkBand;
  letterPx: number;
  numeralPx: number;
  showNumerals: boolean;
}

/** The locale's name as one word on ruled cells: ink letters, a tint band, an ink chevron (the house is not a seat). */
export function strip(locale: MarkLocale, cellPx: number): Strip {
  const primary = LAYOUTS[locale].primary;
  const flat = { ...primary, row: 0, col: 0 };
  return {
    cellPx,
    width: primary.word.length * cellPx,
    height: cellPx,
    letters: place(flat),
    band: band(flat, cellPx),
    ...typeScale(cellPx),
  };
}

export interface CellMark {
  letter: string;
  value: number;
  /** A call or rematch waiting turns the letter the opponent's colour; the band never changes (§6). */
  tone: Seat;
}

const CELL_LETTER: Record<MarkLocale, string> = { is: "Ð", en: "W" };

export function cellMark(locale: MarkLocale, signal: "none" | "call"): CellMark {
  const letter = CELL_LETTER[locale];
  return { letter, value: VALUES[locale][letter] ?? 0, tone: signal === "call" ? "opp" : "you" };
}

/** The ~150° chevron on a band's reading-start edge: arm depth 9% of a cell (design system §5.2). */
export function chevronPath(b: MarkBand, cellPx: number): string {
  const depth = 0.09 * cellPx;
  const r = (n: number) => Math.round(n * 10) / 10;
  if (b.chevronEdge === "left") {
    const x = b.x + 2;
    return `M${r(x)} ${r(b.y + 1)} L${r(x + depth)} ${r(b.y + b.h / 2)} L${r(x)} ${r(b.y + b.h - 1)}`;
  }
  const y = b.y + 2;
  return `M${r(b.x + 1)} ${r(y)} L${r(b.x + b.w / 2)} ${r(y + depth)} L${r(b.x + b.w - 1)} ${r(y)}`;
}
