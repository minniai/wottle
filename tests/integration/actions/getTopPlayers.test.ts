import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { getTopPlayers } from "@/app/actions/player/getTopPlayers";
import { getServiceRoleClient } from "@/lib/supabase/server";

const supabase = getServiceRoleClient();

const testPlayers = [
  { username: "tp-alpha", display_name: "Tp Alpha", elo_rating: 2000 },
  { username: "tp-beta", display_name: "Tp Beta", elo_rating: 1800 },
  { username: "tp-gamma", display_name: "Tp Gamma", elo_rating: 1600 },
];

const createdIds: string[] = [];

beforeAll(async () => {
  for (const row of testPlayers) {
    const { data, error } = await supabase
      .from("players")
      .upsert(
        {
          username: row.username,
          display_name: row.display_name,
          elo_rating: row.elo_rating,
          status: "available",
        },
        { onConflict: "username" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`Test setup failed: ${error.message}`);
    if (data?.id) createdIds.push(data.id);
  }
});

afterAll(async () => {
  if (createdIds.length === 0) return;
  await supabase.from("players").delete().in("id", createdIds);
});

describe("getTopPlayers", () => {
  test("returns players ordered by elo rating descending", async () => {
    const result = await getTopPlayers({ limit: 6 });
    expect(result.players.length).toBeGreaterThan(0);
    for (let i = 0; i < result.players.length - 1; i++) {
      expect(result.players[i].eloRating).toBeGreaterThanOrEqual(
        result.players[i + 1].eloRating,
      );
    }
  });

  test("respects the limit argument", async () => {
    const result = await getTopPlayers({ limit: 2 });
    expect(result.players.length).toBeLessThanOrEqual(2);
  });

  test("rejects invalid limit values", async () => {
    await expect(getTopPlayers({ limit: 0 })).rejects.toThrow();
    await expect(getTopPlayers({ limit: 101 })).rejects.toThrow();
  });

  test("each row validates against topPlayerRowSchema", async () => {
    const { topPlayerRowSchema } = await import("@/lib/types/lobby");
    const result = await getTopPlayers({ limit: 6 });
    for (const row of result.players) {
      expect(() => topPlayerRowSchema.parse(row)).not.toThrow();
    }
  });
});
