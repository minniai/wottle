import { describe, expect, test } from "vitest";

import {
  recentGameRowSchema,
  topPlayerRowSchema,
} from "@/lib/types/lobby";

describe("lobby shared schemas", () => {
  test("topPlayerRowSchema accepts a valid row", () => {
    const row = {
      id: "p-1",
      username: "sigga",
      displayName: "Sigríður",
      eloRating: 1842,
      avatarUrl: null,
      wins: 128,
      losses: 94,
    };
    expect(topPlayerRowSchema.parse(row)).toEqual(row);
  });

  test("topPlayerRowSchema rejects negative wins", () => {
    expect(() =>
      topPlayerRowSchema.parse({
        id: "p-1",
        username: "sigga",
        displayName: "Sigríður",
        eloRating: 1842,
        avatarUrl: null,
        wins: -1,
        losses: 0,
      }),
    ).toThrow();
  });

  test("recentGameRowSchema accepts a win/loss/draw result", () => {
    const base = {
      matchId: "m-1",
      result: "win" as const,
      opponentId: "p-2",
      opponentUsername: "halli",
      opponentDisplayName: "Halli",
      yourScore: 312,
      opponentScore: 278,
      wordsFound: 18,
      completedAt: "2026-04-20T12:00:00.000Z",
    };
    expect(recentGameRowSchema.parse(base).result).toBe("win");
    expect(
      recentGameRowSchema.parse({ ...base, result: "loss" }).result,
    ).toBe("loss");
    expect(
      recentGameRowSchema.parse({ ...base, result: "draw" }).result,
    ).toBe("draw");
  });

  test("recentGameRowSchema rejects unknown result values", () => {
    expect(() =>
      recentGameRowSchema.parse({
        matchId: "m-1",
        result: "abandoned",
        opponentId: "p-2",
        opponentUsername: "x",
        opponentDisplayName: "X",
        yourScore: 0,
        opponentScore: 0,
        wordsFound: 0,
        completedAt: "2026-04-20T12:00:00.000Z",
      }),
    ).toThrow();
  });
});
