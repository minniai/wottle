import { z } from "zod";
import { GameConfig } from "@/lib/types";
import { DEFAULT_GAME_CONFIG } from "@/lib/constants/game-config";

export const getCoordinateSchema = (config: GameConfig = DEFAULT_GAME_CONFIG) => z.object({
  x: z.number().int().min(0).max(config.boardSize - 1),
  y: z.number().int().min(0).max(config.boardSize - 1),
});

export const getBoardGridSchema = (config: GameConfig = DEFAULT_GAME_CONFIG) => z
  .array(
    z
      .array(
        z.string().length(1).regex(/^[A-ZÁÐÉÍÓÚÝÞÆÖa-záðéíóúýþæö ]$/)
      )
      .length(config.boardSize)
  )
  .length(config.boardSize);

export const getMoveRequestSchema = (config: GameConfig = DEFAULT_GAME_CONFIG) => z.object({
  from: getCoordinateSchema(config),
  to: getCoordinateSchema(config),
});

export const getMoveResultSchema = (config: GameConfig = DEFAULT_GAME_CONFIG) => z.object({
  status: z.enum(["accepted", "rejected"]),
  grid: getBoardGridSchema(config),
  error: z.string().optional(),
});

// Since schemas are now factories, we define the types statically
export interface Coordinate {
  x: number;
  y: number;
}

export type BoardGrid = string[][];

export interface MoveRequest {
  from: Coordinate;
  to: Coordinate;
}

export interface MoveResult {
  status: "accepted" | "rejected";
  grid: BoardGrid;
  error?: string;
}

// Keep the old exported schemas pointing to default config for backwards compat, 
// so the rest of the app doesn't immediately break.
export const coordinateSchema = getCoordinateSchema();
export const boardGridSchema = getBoardGridSchema();
export const moveRequestSchema = getMoveRequestSchema();
export const moveResultSchema = getMoveResultSchema();

// ─── Word Engine Types (003-word-engine-scoring) ──────────────────────

export type Direction =
  | "right"
  | "left"
  | "down"
  | "up"
  | "down-right"
  | "down-left"
  | "up-right"
  | "up-left";

/** A valid word found on the board before scoring rules are applied. */
export interface BoardWord {
  /** NFC-normalized, lowercased word text */
  text: string;
  /** Original-case text for UI display */
  displayText: string;
  /** Direction the word reads on the board */
  direction: Direction;
  /** Starting tile coordinate */
  start: Coordinate;
  /** Number of letters (≥2) */
  length: number;
  /** Ordered coordinates of each letter in the word */
  tiles: Coordinate[];
}

/** Result of scanning a board for valid words. */
export interface ScanResult {
  /** All valid words found on the board */
  words: BoardWord[];
  /** Timestamp from performance.now() when scan started */
  scannedAt: number;
  /** Duration of the scan in milliseconds */
  durationMs: number;
}
