import { boardGridSchema, coordinateSchema, type BoardGrid, type Coordinate, type MoveRequest } from "../types/board";

// Re-export types for convenience
export type { BoardGrid, Coordinate, MoveRequest };

export function cloneGrid(grid: BoardGrid): BoardGrid {
  return grid.map((row) => [...row]) as BoardGrid;
}

export function assertCoordinate(coordinate: Coordinate) {
  coordinateSchema.parse(coordinate);
}

export function applySwap(grid: BoardGrid, move: MoveRequest): BoardGrid {
  assertCoordinate(move.from);
  assertCoordinate(move.to);

  if (move.from.x === move.to.x && move.from.y === move.to.y) {
    throw new Error("Cannot swap a tile with itself");
  }

  const next = cloneGrid(boardGridSchema.parse(grid));

  const a = next[move.from.y][move.from.x];
  const b = next[move.to.y][move.to.x];

  next[move.from.y][move.from.x] = b;
  next[move.to.y][move.to.x] = a;

  return next;
}

export function serializeGrid(grid: BoardGrid): string {
  return grid.map((row) => row.join("")).join("\n");
}

export function deserializeGrid(serialized: string): BoardGrid {
  const rows = serialized
    .trim()
    .split(/\n+/)
    .map((row) => row.trim().split(""));
  return boardGridSchema.parse(rows);
}
