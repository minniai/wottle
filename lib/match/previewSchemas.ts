import { z } from "zod";

import { ALL_LETTERS } from "@/lib/game-engine/languagePack";

/**
 * Input contract of the read-only `previewSwap` Server Action
 * (specs/044-field-ledger-redesign/contracts/preview-swap.md). Lives outside
 * the "use server" module because such modules may only export async functions.
 */
const coordinateSchema = z.object({
  x: z.number().int().min(0).max(9),
  y: z.number().int().min(0).max(9),
});

/** A letter any playable language can put on a board (spec 060). */
const boardLetter = z.string().refine((letter) => ALL_LETTERS.has(letter), "Not a board letter");

export const previewSwapInputSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("match"),
      matchId: z.string().min(1),
      from: coordinateSchema,
      to: coordinateSchema,
    }),
    z.object({
      kind: z.literal("warmup"),
      board: z.array(z.array(boardLetter).length(10)).length(10),
      from: coordinateSchema,
      to: coordinateSchema,
      /** The lobby's game language; Icelandic when omitted. */
      language: z.enum(["is", "en"]).optional(),
    }),
  ])
  .refine((v) => v.from.x !== v.to.x || v.from.y !== v.to.y, {
    message: "Cannot swap a tile with itself",
  });

export type PreviewSwapInput = z.infer<typeof previewSwapInputSchema>;
