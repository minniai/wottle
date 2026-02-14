import { z } from "zod";

import { BOARD_MAX_INDEX, BOARD_SIZE } from "@/lib/constants/board";

export const coordinateSchema = z.object({
  x: z.number().int().min(0).max(BOARD_MAX_INDEX),
  y: z.number().int().min(0).max(BOARD_MAX_INDEX),
});

export const boardGridSchema = z
  .array(
    z
      .array(
        z.string().length(1).regex(/^[A-ZÁÐÉÍÓÚÝÞÆÖa-záðéíóúýþæö]$/)
      )
      .length(BOARD_SIZE)
  )
  .length(BOARD_SIZE);

export const moveRequestSchema = z.object({
  from: coordinateSchema,
  to: coordinateSchema,
});

export const moveResultSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  grid: boardGridSchema,
  error: z.string().optional(),
});

export type Coordinate = z.infer<typeof coordinateSchema>;
export type BoardGrid = z.infer<typeof boardGridSchema>;
export type MoveRequest = z.infer<typeof moveRequestSchema>;
export type MoveResult = z.infer<typeof moveResultSchema>;

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
  /** Number of letters (≥3) */
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
