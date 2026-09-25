import { computeBandRect, type BandRect } from "@/lib/room/bandGeometry";
import { tryDeriveReadingDirection } from "@/lib/game-engine/readingDirection";
import type { Band } from "@/lib/types/standing";

export interface MapBand {
  seat: Band["seat"];
  /** In the field's units: the grid is 100 × 100, a cell 10 (draw with viewBox="0 0 100 100"). */
  rect: BandRect;
  edge: BandRect["chevronEdge"];
  chevron: string;
}

/**
 * The band map (spec 070 US2.4, game flow B1): the last match's scored words as
 * bands on a 10×10 grid of rules, in each owner's seat colour, with their
 * chevrons. A word's direction comes from its tile order. The field's geometry
 * (design system §5.2), with the ends inset further (2026-09-25): at 34px a cell,
 * the field's 5% put a word's chevron on the map's edge line.
 */
export function bandMap(bands: Band[]): MapBand[] {
  return bands.flatMap((band) => {
    const direction = tryDeriveReadingDirection(band.tiles);
    if (!direction) return [];
    const rect = insetEnds(computeBandRect(band.tiles, direction));
    return [{ seat: band.seat, rect, edge: rect.chevronEdge, chevron: mapChevron(rect) }];
  });
}

/** 14% of a cell at each end, where the field has 5%. */
const END_INSET = 1.4;
const FIELD_END_INSET = 0.5;
/** 12% of a cell deep, sharper than the field's 9%, so it reads as ▸ at this size. */
const CHEVRON_DEPTH = 1.2;

function insetEnds(rect: BandRect): BandRect {
  const extra = END_INSET - FIELD_END_INSET;
  const round = (n: number) => Math.round(n * 10) / 10;
  return rect.axis === "horizontal"
    ? { ...rect, x: round(rect.x + extra), w: round(rect.w - 2 * extra) }
    : { ...rect, y: round(rect.y + extra), h: round(rect.h - 2 * extra) };
}

function mapChevron({ x, y, w, h, chevronEdge }: BandRect): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  const [cx, cy, d] = [r(x + w / 2), r(y + h / 2), CHEVRON_DEPTH];
  switch (chevronEdge) {
    case "left":
      return `M${x} ${y} L${r(x + d)} ${cy} L${x} ${r(y + h)}`;
    case "right":
      return `M${r(x + w)} ${y} L${r(x + w - d)} ${cy} L${r(x + w)} ${r(y + h)}`;
    case "top":
      return `M${x} ${y} L${cx} ${r(y + d)} L${r(x + w)} ${y}`;
    case "bottom":
      return `M${x} ${r(y + h)} L${cx} ${r(y + h - d)} L${r(x + w)} ${r(y + h)}`;
  }
}

export interface MapLetter {
  x: number;
  y: number;
  letter: string;
  /** Who froze it first (spec 049); null for a letter no word scored. */
  seat: Band["seat"] | null;
}

/**
 * The final board's letters over the band map (2026-09-25): the match as it ended.
 * Bands arrive in the order they were scored, so the first to claim a crossing
 * letter keeps it, as on the field.
 */
export function mapLetters(board: string[][] | null, bands: Band[]): MapLetter[] {
  if (!board) return [];
  const owner = new Map<string, Band["seat"]>();
  for (const band of bands) {
    for (const t of band.tiles) if (!owner.has(`${t.x},${t.y}`)) owner.set(`${t.x},${t.y}`, band.seat);
  }
  return board.flatMap((row, y) => row.map((letter, x) => ({ x, y, letter, seat: owner.get(`${x},${y}`) ?? null })));
}
