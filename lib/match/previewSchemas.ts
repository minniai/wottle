import { z } from "zod";

/**
 * Input contract of the read-only `previewSwap` Server Action
 * (specs/044-field-ledger-redesign/contracts/preview-swap.md). Lives outside
 * the "use server" module because such modules may only export async functions.
 */
const coordinateSchema = z.object({
  x: z.number().int().min(0).max(9),
  y: z.number().int().min(0).max(9),
});

const ICELANDIC_LETTER = /^[A-ZÁÐÉÍÓÚÝÞÆÖ]$/u;

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
      board: z.array(z.array(z.string().regex(ICELANDIC_LETTER)).length(10)).length(10),
      from: coordinateSchema,
      to: coordinateSchema,
    }),
  ])
  .refine((v) => v.from.x !== v.to.x || v.from.y !== v.to.y, {
    message: "Cannot swap a tile with itself",
  });

export type PreviewSwapInput = z.infer<typeof previewSwapInputSchema>;
