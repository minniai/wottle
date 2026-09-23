/** One of a player's ten moves on a track: still to play, in flight, or played. */
export type SegmentState = "left" | "scoring" | "spent";

/**
 * A player's moves in reading order (design system §5.3; spec 068): the moves
 * left first, the spent ones after, so a resolved move empties the rightmost.
 * The move in flight is the rightmost one still left.
 */
export function segmentStates(movesPlayed: number, moveLimit: number, moveInFlight: boolean): SegmentState[] {
  const left = Math.max(0, moveLimit - movesPlayed);
  return Array.from({ length: moveLimit }, (_, i) => {
    if (i >= left) return "spent";
    return moveInFlight && i === left - 1 ? "scoring" : "left";
  });
}
