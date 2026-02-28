import { getBoardGridSchema, getCoordinateSchema, type BoardGrid, type Coordinate, type MoveRequest } from "@/lib/types/board";
import { GameConfig } from "@/lib/types";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

// Re-export types for convenience
export type { BoardGrid, Coordinate, MoveRequest };

export function cloneGrid(grid: BoardGrid): BoardGrid {
  return grid.map((row) => [...row]) as BoardGrid;
}

export function assertCoordinate(coordinate: Coordinate, config: GameConfig = DEFAULT_GAME_CONFIG) {
  getCoordinateSchema(config).parse(coordinate);
}

export function applySwap(grid: BoardGrid, move: MoveRequest, config: GameConfig = DEFAULT_GAME_CONFIG): BoardGrid {
  assertCoordinate(move.from, config);
  assertCoordinate(move.to, config);

  if (move.from.x === move.to.x && move.from.y === move.to.y) {
    throw new Error("Cannot swap a tile with itself");
  }

  const next = cloneGrid(getBoardGridSchema(config).parse(grid));

  const a = next[move.from.y][move.from.x];
  const b = next[move.to.y][move.to.x];

  next[move.from.y][move.from.x] = b;
  next[move.to.y][move.to.x] = a;

  return next;
}

export function serializeGrid(grid: BoardGrid): string {
  return grid.map((row) => row.join("")).join("\n");
}

export function deserializeGrid(serialized: string, config: GameConfig = DEFAULT_GAME_CONFIG): BoardGrid {
  const rows = serialized
    .trim()
    .split(/\n+/)
    .map((row) => row.trim().split(""));
  return getBoardGridSchema(config).parse(rows);
}
