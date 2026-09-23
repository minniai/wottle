/**
 * Spec 070 T004: the columns and tables the door, the lobby, challenges and
 * presence stand on. Live local Supabase; skips without one.
 */
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

async function createPlayers(count: number): Promise<string[]> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const rows = Array.from({ length: count }, (_, i) => ({ username: `t070-col-${i}-${suffix}`, display_name: `P${i}`, status: "available" }));
  const { data, error } = await db!.client.from("players").insert(rows).select("id, username");
  if (error || !data) throw new Error(`players.insert: ${error?.message}`);
  return data.sort((p, q) => p.username.localeCompare(q.username)).map((p) => p.id as string);
}

describe.skipIf(!db)("door and lobby schema (spec 070)", () => {
  let players: string[] = [];

  afterEach(async () => {
    await db!.client.from("presence_tabs").delete().in("player_id", players);
    await db!.client.from("match_invitations").delete().in("sender_id", players);
    await db!.client.from("match_heartbeats").delete().in("player_id", players);
    await db!.client.from("matches").delete().in("player_a_id", players);
    await db!.client.from("players").delete().in("id", players);
  });

  it("a tab is a row of its own, and only the server may read it", async () => {
    players = await createPlayers(1);
    const tab = {
      tab_id: crypto.randomUUID(),
      player_id: players[0],
      language: "is",
      page: "lobby",
      visible: true,
      cadence_ms: 10_000,
    };
    const inserted = await db!.client.from("presence_tabs").insert(tab).select("tab_id, beat_at, hidden_since, last_input_at, leaving_at").single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.beat_at).toBeTruthy();
    const badCadence = await db!.client.from("presence_tabs").insert({ ...tab, tab_id: crypto.randomUUID(), cadence_ms: 5_000 });
    expect(badCadence.error?.message).toMatch(/presence_tabs_cadence_ms_check/);
    const badPage = await db!.client.from("presence_tabs").insert({ ...tab, tab_id: crypto.randomUUID(), page: "queue" });
    expect(badPage.error?.message).toMatch(/presence_tabs_page_check/);

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await anon.from("presence_tabs").select("tab_id").eq("player_id", players[0]);
    expect(data ?? []).toHaveLength(0);
  });

  it("players keep their lobby language and a result they have not seen", async () => {
    players = await createPlayers(2);
    const ok = await db!.client.from("players").update({ lobby_language: "en" }).eq("id", players[0]);
    expect(ok.error).toBeNull();
    const bad = await db!.client.from("players").update({ lobby_language: "dk" }).eq("id", players[0]);
    expect(bad.error?.message).toMatch(/players_lobby_language_check/);
    const match = await db!.client
      .from("matches")
      .insert({ board_seed: crypto.randomUUID(), player_a_id: players[0], player_b_id: players[1], state: "pending" })
      .select("id")
      .single();
    const unseen = await db!.client.from("players").update({ unseen_result_match_id: match.data!.id }).eq("id", players[0]);
    expect(unseen.error).toBeNull();
  });

  it("a challenge expires at a time of its own, can end as left, and can be silenced", async () => {
    players = await createPlayers(2);
    const { data, error } = await db!.client
      .from("match_invitations")
      .insert({ sender_id: players[0], recipient_id: players[1], status: "left", auto_declined: false })
      .select("created_at, expires_at")
      .single();
    expect(error).toBeNull();
    const ttl = Date.parse(data!.expires_at) - Date.parse(data!.created_at);
    expect(ttl).toBeGreaterThanOrEqual(59_000);
    expect(ttl).toBeLessThanOrEqual(61_000);
    const silenced = await db!.client
      .from("match_invitations")
      .insert({ sender_id: players[0], recipient_id: players[1], status: "declined", auto_declined: true });
    expect(silenced.error).toBeNull();
  });

  it("a match heartbeat says whether it came from the match or from a page", async () => {
    players = await createPlayers(2);
    const match = await db!.client
      .from("matches")
      .insert({ board_seed: crypto.randomUUID(), player_a_id: players[0], player_b_id: players[1], state: "pending" })
      .select("id")
      .single();
    const page = await db!.client
      .from("match_heartbeats")
      .insert({ match_id: match.data!.id, player_id: players[0], source: "page", cadence_ms: 10_000 })
      .select("source, cadence_ms")
      .single();
    expect(page.error).toBeNull();
    expect(page.data).toEqual({ source: "page", cadence_ms: 10_000 });
    const bad = await db!.client.from("match_heartbeats").insert({ match_id: match.data!.id, player_id: players[1], source: "lobby" });
    expect(bad.error?.message).toMatch(/match_heartbeats_source_check/);
  });
});
