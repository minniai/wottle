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
