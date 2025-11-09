import { z } from "zod";

export const coordinateSchema = z.object({
  x: z.number().int().min(0).max(15),
  y: z.number().int().min(0).max(15),
});

export const boardGridSchema = z
  .array(z.array(z.string().length(1).regex(/^[A-ZÁÐÉÍÓÚÝÞÆÖa-záðéíóúýþæö]$/)).length(16))
  .length(16);

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
