/**
 * Spec 069 US4 (T045): a queue that never pairs a ghost. Candidates in the
 * order they joined, only those heard from within 10s and not paused; a poll
 * never rewrites the join time; a hidden tab pauses the search; two table
 * leaves in 10 minutes refuse a search. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { startAutoQueue } from "@/lib/matchmaking/inviteService";

import { connectTestDb } from "./harness";

const db = await connectTestDb();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe.skipIf(!db)("the queue (spec 069)", () => {
  let players: string[] = [];
  const client = () => db!.client;

  async function createPlayers(names: string[]): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data, error } = await client()
      .from("players")
      .insert(names.map((n) => ({ username: `t069-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available" })))
      .select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    const ids = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    players.push(...ids);
    return ids;
  }

  const searching = (id: string, queuedAgoMs: number, seenAgoMs = 1_000, paused = false) =>
    client().from("players").update({ status: "matchmaking", queue_language: "is", queued_at: ago(queuedAgoMs), last_seen_at: ago(seenAgoMs), search_paused: paused }).eq("id", id);
  const row = async (id: string) =>
    (await client().from("players").select("status, queued_at, search_paused").eq("id", id).single()).data as { status: string; queued_at: string | null; search_paused: boolean };

  afterEach(async () => {
    const list = players.join(",");
    await client().from("matches").delete().or(`player_a_id.in.(${list}),player_b_id.in.(${list}),voided_by.in.(${list})`);
    await client().from("players").delete().in("id", players);
    players = [];
  });

  it("pairs with the searcher who joined first among the fresh, never a stale or paused one", async () => {
    const [a, early, later, ghost, away] = await createPlayers(["A", "Early", "Later", "Ghost", "Away"]);
    await searching(early, 60_000);
    await searching(later, 30_000);
    await searching(ghost, 90_000, 12_000);
    await searching(away, 120_000, 1_000, true);
    const result = await startAutoQueue(client(), { playerId: a, language: "is", attention: { visible: true, inputAgoMs: 500 } });
    expect(result.status).toBe("matched");
    const { data: match } = await client().from("matches").select("player_a_id, player_b_id").eq("id", result.matchId!).single();
    expect([match!.player_a_id, match!.player_b_id].sort()).toEqual([a, early].sort());
  });

  it("a poll never rewrites the join time; a fresh search starts it now", async () => {
    const [a] = await createPlayers(["A"]);
    const first = await startAutoQueue(client(), { playerId: a, language: "is" });
    expect(first.status).toBe("queued");
    const joined = (await row(a)).queued_at;
    expect(joined).not.toBeNull();
    expect(Date.now() - Date.parse(joined!)).toBeLessThan(5_000);
    await new Promise((r) => setTimeout(r, 50));
    await startAutoQueue(client(), { playerId: a, language: "is" });
    expect((await row(a)).queued_at).toBe(joined);
  });

  it("a searcher long gone who searches again starts at the back, not at their old place", async () => {
    const [a] = await createPlayers(["A"]);
    await searching(a, 3_600_000, 60_000);
    await startAutoQueue(client(), { playerId: a, language: "is" });
    expect(Date.now() - Date.parse((await row(a)).queued_at!)).toBeLessThan(5_000);
  });

  it("a hidden tab pauses the search and keeps its place; the next visible poll resumes it", async () => {
    const [a] = await createPlayers(["A"]);
    await searching(a, 40_000);
    const place = (await row(a)).queued_at;
    const hidden = await startAutoQueue(client(), { playerId: a, language: "is", attention: { visible: false, inputAgoMs: 5_000 } });
    expect(hidden.status).toBe("paused");
    expect(await row(a)).toMatchObject({ status: "matchmaking", search_paused: true, queued_at: place });
    const back = await startAutoQueue(client(), { playerId: a, language: "is", attention: { visible: true, inputAgoMs: 0 } });
    expect(back.status).toBe("queued");
    expect(await row(a)).toMatchObject({ search_paused: false, queued_at: place });
  });

  it("two table leaves in 10 minutes refuse a search, with the time it ends", async () => {
    const [a, b] = await createPlayers(["A", "B"]);
    for (const leftAgoMs of [5 * 60_000, 60_000]) {
      const seated = new Date().toISOString();
      await client().from("matches").insert({
        board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "completed", language: "is",
        ended_reason: "void", void_reason: "left", voided_by: a, completed_at: ago(leftAgoMs), player_a_seated_at: seated, player_b_seated_at: seated,
      });
    }
    const refused = await startAutoQueue(client(), { playerId: a, language: "is" });
    expect(refused.status).toBe("cooldown");
    expect(Date.parse(refused.until!) - Date.now()).toBeGreaterThan(3.5 * 60_000);
    expect((await row(a)).status).not.toBe("matchmaking");
  });
});
