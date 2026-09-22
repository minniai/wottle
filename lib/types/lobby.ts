import { z } from "zod";

export const topPlayerRowSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  username: z.string().min(1),
  displayName: z.string().min(1),
  eloRating: z.number().int().nonnegative(),
  avatarUrl: z.string().url().nullable(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});

export type TopPlayerRow = z.infer<typeof topPlayerRowSchema>;

export const recentGameRowSchema = z.object({
  matchId: z.string().min(1),
  result: z.enum(["win", "loss", "draw"]),
  opponentId: z.string().min(1),
  opponentUsername: z.string().min(1),
  opponentDisplayName: z.string().min(1),
  // Matches from 2026-09-21 until the §5.6 floor (2026-09-22) can have totals below zero.
  yourScore: z.number().int(),
  opponentScore: z.number().int(),
  wordsFound: z.number().int().nonnegative(),
  completedAt: z.string(),
});

export type RecentGameRow = z.infer<typeof recentGameRowSchema>;
