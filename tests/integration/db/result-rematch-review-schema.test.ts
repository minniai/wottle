/**
 * Spec 071 T003: the columns and functions the result, rematch and review stand on.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

async function createPlayers(count: number): Promise<string[]> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const rows = Array.from({ length: count }, (_, i) => ({ username: `t071-col-${i}-${suffix}`, display_name: `P${i}`, status: "available" }));
  const { data, error } = await db!.client.from("players").insert(rows).select("id, username");
  if (error || !data) throw new Error(`players.insert: ${error?.message}`);
  return data.sort((p, q) => p.username.localeCompare(q.username)).map((p) => p.id as string);
}

async function completedMatch(a: string, b: string): Promise<string> {
  const { data, error } = await db!.client
    .from("matches")
    .insert({ board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "completed", ended_reason: "moves_complete", completed_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error(`matches.insert: ${error?.message}`);
  return data.id as string;
}

describe.skipIf(!db)("result, rematch and review schema (spec 071)", () => {
  let players: string[] = [];

  afterEach(async () => {
    await db!.client.from("presence_tabs").delete().in("player_id", players);
    await db!.client.from("rematch_requests").delete().in("requester_id", players);
    await db!.client.from("matches").delete().in("player_a_id", players);
    await db!.client.from("players").delete().in("id", players);
  });

  it("a tab names the match it is on", async () => {
    players = await createPlayers(2);
    const matchId = await completedMatch(players[0], players[1]);
    const tab = { tab_id: crypto.randomUUID(), player_id: players[0], language: "is", page: "match", visible: false, cadence_ms: 30_000, match_id: matchId };
    const { error } = await db!.client.from("presence_tabs").insert(tab);
    expect(error).toBeNull();
    const onMatch = await db!.client.rpc("player_on_match", { p_player: players[0], p_match: matchId });
    expect(onMatch.error).toBeNull();
    expect(onMatch.data).toBe(true);
    const other = await db!.client.rpc("player_on_match", { p_player: players[1], p_match: matchId });
    expect(other.data).toBe(false);
  });

  it("a rematch request expires 30s after it was made", async () => {
    players = await createPlayers(2);
    const matchId = await completedMatch(players[0], players[1]);
    const { data, error } = await db!.client
      .from("rematch_requests")
      .insert({ match_id: matchId, requester_id: players[0], responder_id: players[1] })
      .select("created_at, expires_at")
      .single();
    expect(error).toBeNull();
    const ttl = Date.parse(data!.expires_at) - Date.parse(data!.created_at);
    expect(ttl).toBeGreaterThanOrEqual(29_000);
    expect(ttl).toBeLessThanOrEqual(31_000);
  });

  it("a match can end early", async () => {
    players = await createPlayers(2);
    const matchId = await completedMatch(players[0], players[1]);
    const { error } = await db!.client.from("matches").update({ ended_reason: "ended_early" }).eq("id", matchId);
    expect(error).toBeNull();
  });

  it("the rematch functions, the pair cooldown and the series exist", async () => {
    players = await createPlayers(2);
    const matchId = await completedMatch(players[0], players[1]);
    const calls = [
      db!.client.rpc("pair_cooldown_until", { p_sender: players[0], p_recipient: players[1] }),
      db!.client.rpc("request_rematch", { p_match: matchId, p_actor: players[0] }),
      db!.client.rpc("expire_due_rematches"),
      db!.client.rpc("rematch_series", { p_match: matchId }),
      db!.client.rpc("decline_rematch", { p_request: crypto.randomUUID(), p_actor: players[1] }),
      db!.client.rpc("withdraw_rematch", { p_request: crypto.randomUUID(), p_actor: players[0] }),
    ];
    for (const { error } of await Promise.all(calls)) expect(error).toBeNull();
  });

  it("a tab beat carries the match it is on", async () => {
    players = await createPlayers(2);
    const matchId = await completedMatch(players[0], players[1]);
    const tabId = crypto.randomUUID();
    const { error } = await db!.client.rpc("beat_tab", {
      p_player: players[0], p_tab: tabId, p_visible: true, p_input_ago_ms: 0, p_page: "match", p_match_id: matchId,
    });
    expect(error).toBeNull();
    const row = await db!.client.from("presence_tabs").select("match_id").eq("tab_id", tabId).single();
    expect(row.data?.match_id).toBe(matchId);
  });
});
