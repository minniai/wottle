import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, MoveResolution } from "@/lib/types/match";

export type LastMoves = Record<"you" | "opp", Coordinate[]>;

/**
 * Each seat's most recent swap, as the last-moved tick marks it (spec 068
 * FR-027): the two cells of that seat's latest resolved move, minus any letter
 * frozen since. A refused move changed no letter, so it is never the last move.
 */
export function lastMoves(latest: { you: MoveResolution | null; opp: MoveResolution | null }, frozen: FrozenTileMap): LastMoves {
  const cells = (resolution: MoveResolution | null): Coordinate[] =>
    resolution ? [resolution.swap.from, resolution.swap.to].filter((c) => !frozen[`${c.x},${c.y}`]) : [];
  return { you: cells(latest.you), opp: cells(latest.opp) };
}

/**
 * The seat's latest resolved move, given the one kept and one just arrived: a
 * refusal or an older resolution never replaces it (eng review decision 1A:
 * after a reload onto a refused move there is no tick until the next move).
 */
export function latestResolved(kept: MoveResolution | null, next: MoveResolution): MoveResolution | null {
  if (next.status !== "resolved") return kept;
  return kept && kept.globalSeq > next.globalSeq ? kept : next;
}
