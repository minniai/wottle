import type { Coordinate } from "@/lib/types/board";
import type { ReadingDirection } from "@/lib/types/match";

/**
 * Direction a scored word reads on the field, derived from its ordered tiles.
 * `coordinates[0]` is where reading begins (the chevron sits there); the step
 * to `coordinates[1]` gives the axis and sense. Tile order is preserved end to
 * end (scanner → word_score_entries.tiles → WordScore.coordinates), so no
 * column is needed (spec 044, research R1).
 */
export class InvalidWordGeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWordGeometryError";
  }
}

export function deriveReadingDirection(coordinates: Coordinate[]): ReadingDirection {
  if (coordinates.length < 2) {
    throw new InvalidWordGeometryError("A scored word needs at least two tiles");
  }
  const dx = coordinates[1].x - coordinates[0].x;
  const dy = coordinates[1].y - coordinates[0].y;
  if (dx !== 0 && dy !== 0) {
    throw new InvalidWordGeometryError(`Diagonal step (${dx},${dy}) is not a reading direction`);
  }
  if (dx > 0) return "ltr";
  if (dx < 0) return "rtl";
  if (dy > 0) return "ttb";
  if (dy < 0) return "btt";
  throw new InvalidWordGeometryError("Repeated tile: zero-length step");
}

/** Best-effort variant for legacy payloads: undefined instead of throwing. */
export function tryDeriveReadingDirection(coordinates: Coordinate[]): ReadingDirection | undefined {
  try {
    return deriveReadingDirection(coordinates);
  } catch {
    return undefined;
  }
}
