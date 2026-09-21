import { z } from "zod";

/**
 * Zod schemas for Realtime broadcast payload validation (spec 042).
 *
 * Clients MUST validate inbound broadcast payloads against these schemas
 * before applying to React state. An invalid payload causes the whole
 * `state` event to be discarded and the client falls through to polling.
 *
 * Server-side, these schemas are also useful for asserting outbound shapes
 * in tests so a regression cannot quietly publish a malformed event.
 */

const coordinateSchema = z.object({
  x: z.number().int().min(0).max(9),
  y: z.number().int().min(0).max(9),
});

export const wordScoreSchema = z.object({
  playerId: z.string().uuid(),
  word: z.string().min(1),
  length: z.number().int().min(1),
  lettersPoints: z.number().int().min(0),
  bonusPoints: z.number().int().min(0),
  totalPoints: z.number().int().min(0),
  coordinates: z.array(coordinateSchema).min(1),
  /** Derived from tile order (spec 044); optional so older payloads still validate. */
  direction: z.enum(["ltr", "rtl", "ttb", "btt"]).optional(),
});

export const scoreTotalsSchema = z.object({
  playerA: z.number().int().min(0),
  playerB: z.number().int().min(0),
});

const frozenTileSchema = z.object({
  owner: z.enum(["player_a", "player_b"]),
  scoredAxes: z.array(z.enum(["horizontal", "vertical"])).optional(),
});

export const frozenTileMapSchema = z.record(z.string(), frozenTileSchema);

// ─── Spec 050 ─────────────────────────────────────────────────────────

const boardGridSchema = z.array(z.array(z.string().length(1)).length(10)).length(10);

/** Body of `POST /api/match/[matchId]/move`: the swap and the two letters the player saw. */
export const moveRequestSchema = z
  .object({
    fromX: z.number().int().min(0).max(9),
    fromY: z.number().int().min(0).max(9),
    toX: z.number().int().min(0).max(9),
    toY: z.number().int().min(0).max(9),
    fromLetter: z.string().length(1),
    toLetter: z.string().length(1),
  })
  .refine((m) => m.fromX !== m.toX || m.fromY !== m.toY, { message: "Cannot swap a tile with itself" });

export type MoveRequestPayload = z.infer<typeof moveRequestSchema>;

/** The `move-resolved` broadcast (contracts/move-resolved-event.md). */
export const moveResolutionSchema = z.object({
  matchId: z.string().uuid(),
  moveId: z.string().uuid(),
  playerId: z.string().uuid(),
  globalSeq: z.number().int().min(1),
  seq: z.number().int().min(1).max(10).nullable(),
  status: z.enum(["resolved", "rejected"]),
  rejectionReason: z.enum(["frozen", "moved"]).optional(),
  swap: z.object({ from: coordinateSchema, to: coordinateSchema }),
  board: boardGridSchema,
  words: z.array(wordScoreSchema).max(20),
  delta: z.number().int().min(0),
  totals: scoreTotalsSchema,
  frozenTiles: frozenTileMapSchema,
  movesPlayed: z.object({ playerA: z.number().int().min(0).max(10), playerB: z.number().int().min(0).max(10) }),
  resolvedAt: z.string().datetime(),
});

export type MoveResolutionPayload = z.infer<typeof moveResolutionSchema>;
