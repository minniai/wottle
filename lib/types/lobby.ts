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
  // Totals can go below zero since the miss penalty (rules §5.6).
  yourScore: z.number().int(),
  opponentScore: z.number().int(),
  wordsFound: z.number().int().nonnegative(),
  completedAt: z.string(),
});

export type RecentGameRow = z.infer<typeof recentGameRowSchema>;
