/**
 * Spec 060 FR-018, SC-003: the queue pairs players only within one language.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { startAutoQueue } from "@/lib/matchmaking/inviteService";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

async function createPlayers(names: string[]): Promise<string[]> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const { data, error } = await db!.client
    .from("players")
    .insert(names.map((n) => ({ username: `tq-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available" })))
    .select("id, display_name");
  if (error || !data) throw new Error(`players.insert: ${error?.message}`);
  return names.map((n) => data.find((p) => p.display_name === n)!.id as string);
}

describe.skipIf(!db)("the queue by language (spec 060)", () => {
  let players: string[] = [];

  afterEach(async () => {
    await db!.client.from("matches").delete().or(`player_a_id.in.(${players.join(",")}),player_b_id.in.(${players.join(",")})`);
    await db!.client.from("players").delete().in("id", players);
  });

  it("an Icelandic and an English player waiting together are never paired", async () => {
    players = await createPlayers(["Kari", "Anna"]);
    const [kari, anna] = players;
    await startAutoQueue(db!.client, { playerId: kari, language: "is" });
    const again = await Promise.all([
      startAutoQueue(db!.client, { playerId: anna, language: "en" }),
      startAutoQueue(db!.client, { playerId: kari, language: "is" }),
    ]);
    expect(again.map((r) => r.status)).toEqual(["queued", "queued"]);
    const { data } = await db!.client.from("players").select("id, status, queue_language").in("id", players);
    expect(Object.fromEntries((data ?? []).map((p) => [p.id, p.queue_language]))).toEqual({ [kari]: "is", [anna]: "en" });
  });

  it("two English players are paired, into an English match, and leave the queue", async () => {
    players = await createPlayers(["Anna", "Ben"]);
    const [anna, ben] = players;
    await startAutoQueue(db!.client, { playerId: anna, language: "en" });
    const results = await Promise.all([
      startAutoQueue(db!.client, { playerId: ben, language: "en" }),
      startAutoQueue(db!.client, { playerId: anna, language: "en" }),
    ]);
    const matchId = results.find((r) => r.status === "matched")?.matchId;
    expect(matchId).toBeTruthy();
    const { data: match } = await db!.client.from("matches").select("language").eq("id", matchId!).single();
    expect(match?.language).toBe("en");
    const { data } = await db!.client.from("players").select("queue_language").in("id", players);
    expect((data ?? []).map((p) => p.queue_language)).toEqual([null, null]);
  });
});
