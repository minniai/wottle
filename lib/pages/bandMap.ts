import { chevronPath, computeBandRect, type BandRect } from "@/lib/room/bandGeometry";
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
 * chevrons. A word's direction comes from its tile order.
 * The geometry is the field's own (design system §5.2), so it scales with its box.
 */
export function bandMap(bands: Band[]): MapBand[] {
  return bands.flatMap((band) => {
    const direction = tryDeriveReadingDirection(band.tiles);
    if (!direction) return [];
    const rect = computeBandRect(band.tiles, direction);
    return [{ seat: band.seat, rect, edge: rect.chevronEdge, chevron: chevronPath(rect) }];
  });
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
