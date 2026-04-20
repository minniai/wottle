import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { getRecentGames } from "@/app/actions/match/getRecentGames";
import { getServiceRoleClient } from "@/lib/supabase/server";

const supabase = getServiceRoleClient();

const username = "rg-alpha";
const opponentUsername = "rg-beta";

let playerId: string | null = null;
let opponentId: string | null = null;
const createdMatchIds: string[] = [];

beforeAll(async () => {
  const players = await supabase
    .from("players")
    .upsert(
      [
        { username, display_name: "Rg Alpha", status: "available" },
        {
          username: opponentUsername,
          display_name: "Rg Beta",
          status: "available",
        },
      ],
      { onConflict: "username" },
    )
    .select("id,username");
  if (players.error) throw new Error(players.error.message);
  const rows = players.data as Array<{ id: string; username: string }>;
  playerId = rows.find((r) => r.username === username)?.id ?? null;
  opponentId = rows.find((r) => r.username === opponentUsername)?.id ?? null;

  if (!playerId || !opponentId) throw new Error("Test players not created");

  const now = new Date().toISOString();
  const { data: m1 } = await supabase
    .from("matches")
    .insert({
      player_a_id: playerId,
      player_b_id: opponentId,
      state: "completed",
      winner_id: playerId,
      completed_at: now,
    })
    .select("id")
    .single();
  if (m1?.id) createdMatchIds.push(m1.id);

  const { data: m2 } = await supabase
    .from("matches")
    .insert({
      player_a_id: playerId,
      player_b_id: opponentId,
      state: "completed",
      winner_id: opponentId,
      completed_at: now,
    })
    .select("id")
    .single();
  if (m2?.id) createdMatchIds.push(m2.id);
});

afterAll(async () => {
  if (createdMatchIds.length > 0) {
    await supabase.from("matches").delete().in("id", createdMatchIds);
  }
  if (playerId || opponentId) {
    await supabase
      .from("players")
      .delete()
      .in("id", [playerId, opponentId].filter(Boolean) as string[]);
  }
});

describe("getRecentGames", () => {
  test("returns the current player's completed matches with opponent info", async () => {
    if (!playerId) throw new Error("playerId missing");
    const result = await getRecentGames({ playerId, limit: 10 });
    expect(result.games.length).toBeGreaterThanOrEqual(2);
    const winRow = result.games.find((g) => g.result === "win");
    const lossRow = result.games.find((g) => g.result === "loss");
    expect(winRow?.opponentUsername).toBe(opponentUsername);
    expect(lossRow?.opponentUsername).toBe(opponentUsername);
  });

  test("rejects invalid limits", async () => {
    if (!playerId) throw new Error("playerId missing");
    await expect(getRecentGames({ playerId, limit: 0 })).rejects.toThrow();
  });

  test("each row validates against recentGameRowSchema", async () => {
    if (!playerId) throw new Error("playerId missing");
    const { recentGameRowSchema } = await import("@/lib/types/lobby");
    const result = await getRecentGames({ playerId, limit: 10 });
    for (const row of result.games) {
      expect(() => recentGameRowSchema.parse(row)).not.toThrow();
    }
  });
});
