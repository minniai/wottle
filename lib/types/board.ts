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

/** Spec 050: receipt is the only thing a move request answers; the board arrives with the resolution. */
export const moveResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("accepted"),
    moveId: z.string().uuid(),
    globalSeq: z.number().int().min(1),
    receivedAt: z.string(),
  }),
  z.object({
    status: z.literal("rejected"),
    reason: z.enum(["ended", "not_started", "deadline", "cap", "in_flight"]),
    error: z.string(),
  }),
]);

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

export type MoveResult =
  | { status: "accepted"; moveId: string; globalSeq: number; receivedAt: string }
  | { status: "rejected"; reason: "ended" | "not_started" | "deadline" | "cap" | "in_flight"; error: string };

// Keep the old exported schemas pointing to default config for backwards compat, 
// so the rest of the app doesn't immediately break.
export const coordinateSchema = getCoordinateSchema();
export const boardGridSchema = getBoardGridSchema();
export const moveRequestSchema = getMoveRequestSchema();

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
