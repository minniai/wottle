import type { Coordinate } from "@/lib/types/board";

/**
 * The board the player sees: the server snapshot with in-flight swaps applied
 * (the opponent's pinned move, then the player's own committed or previewed
 * pair). Pure; never mutates the input.
 */
export function applyLetterSwaps(board: string[][], swaps: Array<[Coordinate, Coordinate] | null | undefined>): string[][] {
  const active = swaps.filter((s): s is [Coordinate, Coordinate] => Boolean(s));
  if (active.length === 0) return board;
  const grid = board.map((row) => [...row]);
  for (const [a, b] of active) {
    const tmp = grid[a.y]?.[a.x];
    if (tmp === undefined || grid[b.y]?.[b.x] === undefined) continue;
    grid[a.y][a.x] = grid[b.y][b.x];
    grid[b.y][b.x] = tmp;
  }
  return grid;
}
