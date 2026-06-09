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

/**
 * Schema for `MatchState.partialSummary` (spec 042 § 2.3, realtime-events § 4).
 *
 * The `.max(20)` on words is a defensive cap — a single swap producing 20
 * scored words is astronomically unlikely; a payload claiming more is
 * malformed.
 */
export const partialRoundSummarySchema = z.object({
  matchId: z.string().uuid(),
  roundNumber: z.number().int().min(1).max(10),
  firstMoverId: z.string().uuid(),
  firstSubmissionAt: z.string().datetime(),
  words: z.array(wordScoreSchema).max(20),
  delta: scoreTotalsSchema,
  frozenTiles: frozenTileMapSchema,
});

export type PartialRoundSummaryPayload = z.infer<typeof partialRoundSummarySchema>;
