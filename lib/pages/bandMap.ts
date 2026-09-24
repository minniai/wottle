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
 * chevrons, and nothing else. A word's direction comes from its tile order.
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
