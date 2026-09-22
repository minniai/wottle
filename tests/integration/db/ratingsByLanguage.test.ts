/**
 * Spec 060 US4: a rating for each language. Settling an English match moves
 * only both players' English ratings (starting from 1200 when they have none)
 * and records the change as English; their Icelandic ratings stay as they were.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/match/movePublisher", () => ({ publishMoveResolved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/game-engine/dictionary", () => ({ loadDictionary: vi.fn().mockResolvedValue(new Set()) }));

import { settleMatchIfDue } from "@/lib/match/matchSettlement";

import { connectTestDb, createTestMatch, dropTestMatch, type TestMatch } from "./harness";

const db = await connectTestDb();

async function ratingRows(match: TestMatch) {
  const { data } = await db!.client
    .from("player_ratings")
    .select("player_id, language, elo_rating, games_played, wins, losses")
    .in("player_id", [match.playerAId, match.playerBId]);
  return data ?? [];
}

describe.skipIf(!db)("ratings by language (spec 060 US4)", () => {
  let match: TestMatch;
  afterEach(async () => {
    if (match) {
      await db!.client.from("player_ratings").delete().in("player_id", [match.playerAId, match.playerBId]);
      await dropTestMatch(db!, match);
    }
  });

  it("an English result moves only the English ratings and is recorded as English", async () => {
    match = await createTestMatch(db!, { moves: { a: 10, b: 10 }, language: "en" });
    await db!.client.from("player_ratings").insert([
      { player_id: match.playerAId, language: "is", elo_rating: 1320, games_played: 4, wins: 3, losses: 1, draws: 0 },
      { player_id: match.playerBId, language: "is", elo_rating: 1100, games_played: 2, wins: 0, losses: 2, draws: 0 },
    ]);
    await db!.client.from("matches").update({ player_a_score: 60, player_b_score: 20 }).eq("id", match.matchId);

    expect(await settleMatchIfDue(match.matchId)).toBe("completed");

    const rows = await ratingRows(match);
    const at = (id: string, language: string) => rows.find((r) => r.player_id === id && r.language === language);
    expect(at(match.playerAId, "is")).toMatchObject({ elo_rating: 1320, games_played: 4 });
    expect(at(match.playerBId, "is")).toMatchObject({ elo_rating: 1100, games_played: 2 });
    expect(at(match.playerAId, "en")).toMatchObject({ games_played: 1, wins: 1 });
    expect(at(match.playerBId, "en")).toMatchObject({ games_played: 1, losses: 1 });
    expect(at(match.playerAId, "en")!.elo_rating).toBeGreaterThan(1200);
    expect(at(match.playerBId, "en")!.elo_rating).toBeLessThan(1200);

    const { data: changes } = await db!.client.from("match_ratings").select("language, rating_before").eq("match_id", match.matchId);
    expect(changes?.map((c) => c.language)).toEqual(["en", "en"]);
    expect(changes?.map((c) => c.rating_before)).toEqual([1200, 1200]);
  });

  it("an Icelandic result starts from the Icelandic rating", async () => {
    match = await createTestMatch(db!, { moves: { a: 10, b: 10 } });
    await db!.client.from("player_ratings").insert([
      { player_id: match.playerAId, language: "is", elo_rating: 1320, games_played: 40, wins: 30, losses: 10, draws: 0 },
    ]);
    await db!.client.from("matches").update({ player_a_score: 10, player_b_score: 50 }).eq("id", match.matchId);

    expect(await settleMatchIfDue(match.matchId)).toBe("completed");

    const rows = await ratingRows(match);
    const a = rows.find((r) => r.player_id === match.playerAId && r.language === "is");
    expect(a!.elo_rating).toBeLessThan(1320);
    expect(a!.games_played).toBe(41);
    expect(rows.some((r) => r.language === "en")).toBe(false);
  });
});
