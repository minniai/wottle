/**
 * Spec 067 (T003a): the columns and statuses identity and match creation stand on.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

async function createPlayers(count: number): Promise<string[]> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const rows = Array.from({ length: count }, (_, i) => ({
    username: `t067-col-${i}-${suffix}`,
    display_name: `P${i}`,
    status: "available",
  }));
  const { data, error } = await db!.client.from("players").insert(rows).select("id, username");
  if (error || !data) throw new Error(`players.insert: ${error?.message}`);
  return data.sort((p, q) => p.username.localeCompare(q.username)).map((p) => p.id as string);
}

describe.skipIf(!db)("identity columns (spec 067)", () => {
  let players: string[] = [];

  afterEach(async () => {
    await db!.client.from("match_invitations").delete().in("sender_id", players);
    await db!.client.from("matches").delete().in("player_a_id", players);
    await db!.client.from("players").delete().in("id", players);
  });

  it("players carry a claim hash, when it was claimed and when they last entered", async () => {
    players = await createPlayers(1);
    const { error } = await db!.client
      .from("players")
      .update({ claim_hash: "ab".repeat(32), claimed_at: new Date().toISOString(), last_entered_at: new Date().toISOString() })
      .eq("id", players[0]);
    expect(error).toBeNull();
  });

  it("a match records its origin, and only one of the six", async () => {
    players = await createPlayers(2);
    const base = { board_seed: crypto.randomUUID(), player_a_id: players[0], player_b_id: players[1], state: "pending" };
    const ok = await db!.client.from("matches").insert({ ...base, origin: "crossed_rematch", origin_ref: crypto.randomUUID() });
    expect(ok.error).toBeNull();
    const bad = await db!.client.from("matches").insert({ ...base, board_seed: crypto.randomUUID(), origin: "walk_in" });
    expect(bad.error?.message).toMatch(/matches_origin_check/);
  });

  it("a challenge can be withdrawn or superseded", async () => {
    players = await createPlayers(3);
    const { data, error } = await db!.client
      .from("match_invitations")
      .insert([
        { sender_id: players[0], recipient_id: players[1], status: "withdrawn" },
        { sender_id: players[0], recipient_id: players[2], status: "superseded" },
      ])
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("a rematch request can be withdrawn or superseded", async () => {
    players = await createPlayers(2);
    const { data: match } = await db!.client
      .from("matches")
      .insert({ board_seed: crypto.randomUUID(), player_a_id: players[0], player_b_id: players[1], state: "completed" })
      .select("id")
      .single();
    const { error } = await db!.client
      .from("rematch_requests")
      .insert({ match_id: match!.id, requester_id: players[0], responder_id: players[1], status: "superseded" });
    expect(error).toBeNull();
    await db!.client.from("rematch_requests").delete().eq("match_id", match!.id);
  });
});
