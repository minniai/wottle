/**
 * Spec 070 US6 (T031): presence per tab. A player's state is the best state
 * across their fresh tabs; a reload never drops them; a closed tab is gone 8s
 * after its beacon; all tabs hidden 2:00 is away; a match makes them
 * `in_match`, from `matches`, not from `players.status`. Live local Supabase.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe.skipIf(!db)("presence per tab (spec 070 US6)", () => {
  let players: string[] = [];
  const client = () => db!.client;

  async function createPlayers(names: string[], lobby: "is" | "en" = "is"): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data, error } = await client()
      .from("players")
      .insert(names.map((n) => ({ username: `t070p-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available", lobby_language: lobby })))
      .select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    const ids = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    players.push(...ids);
    return ids;
  }

  const beat = (player: string, tab: string, visible = true, inputAgoMs = 1_000, page = "lobby") =>
    client().rpc("beat_tab", { p_player: player, p_tab: tab, p_visible: visible, p_input_ago_ms: inputAgoMs, p_page: page });
  const presence = async (language: "is" | "en" = "is") => {
    const { data, error } = await client().rpc("player_presence", { p_language: language });
    if (error) throw new Error(error.message);
    return new Map((data as Array<{ player_id: string; state: string; moves_played: number | null }>).filter((r) => players.includes(r.player_id)).map((r) => [r.player_id, r]));
  };
  const age = (tab: string, patch: Record<string, unknown>) => client().from("presence_tabs").update(patch).eq("tab_id", tab);

  afterEach(async () => {
    await client().from("presence_tabs").delete().in("player_id", players);
    await client().from("matches").delete().or(`player_a_id.in.(${players.join(",")}),player_b_id.in.(${players.join(",")})`);
    await client().from("players").delete().in("id", players);
    players = [];
  });

  it("a beat records the tab, keeps the summary row alive and reports the player's attention", async () => {
    const [a] = await createPlayers(["A"]);
    const tab = crypto.randomUUID();
    const first = await beat(a, tab);
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject([{ transition: true, language: "is" }]);
    const again = await beat(a, tab);
    expect(again.data).toMatchObject([{ transition: false }]);
    const hidden = await beat(a, tab, false);
    expect(hidden.data).toMatchObject([{ transition: true }]);
    const { data: row } = await client().from("presence_tabs").select("cadence_ms, hidden_since, language").eq("tab_id", tab).single();
    expect(row).toMatchObject({ cadence_ms: 30_000, language: "is" });
    expect(row!.hidden_since).not.toBeNull();
    const { data: summary } = await client().from("lobby_presence").select("language, expires_at").eq("player_id", a).single();
    expect(summary!.language).toBe("is");
    expect(Date.parse(summary!.expires_at)).toBeGreaterThan(Date.now() + 60_000);
    const { data: me } = await client().from("players").select("attention_visible, attention_input_at").eq("id", a).single();
    expect(me!.attention_visible).toBe(false);
  });

  it("writes the tab's lobby from the player's lobby language, never from the page", async () => {
    const [a] = await createPlayers(["A"], "is");
    const tab = crypto.randomUUID();
    await beat(a, tab, true, 0, "rules");
    const { data } = await client().from("presence_tabs").select("language").eq("tab_id", tab).single();
    expect(data!.language).toBe("is");
    expect((await presence("en")).has(a)).toBe(false);
    expect((await presence("is")).get(a)?.state).toBe("here");
  });

  it("is here while any tab is visible or hidden under 2:00; away once every tab is hidden 2:00", async () => {
    const [a] = await createPlayers(["A"]);
    const [t1, t2] = [crypto.randomUUID(), crypto.randomUUID()];
    await beat(a, t1, false);
    await beat(a, t2, true);
    expect((await presence()).get(a)?.state).toBe("here");
    await beat(a, t2, false);
    await age(t1, { hidden_since: ago(121_000) });
    expect((await presence()).get(a)?.state).toBe("here");
    await age(t2, { hidden_since: ago(125_000) });
    expect((await presence()).get(a)?.state).toBe("away");
  });

  it("drops a tab after three missed beats of its cadence", async () => {
    const [a, b] = await createPlayers(["A", "B"]);
    const [ta, tb] = [crypto.randomUUID(), crypto.randomUUID()];
    await beat(a, ta, true);
    await beat(b, tb, false);
    await age(ta, { beat_at: ago(36_000) });
    await age(tb, { beat_at: ago(90_000) });
    const now = await presence();
    expect(now.has(a)).toBe(false);
    expect(now.get(b)?.state).toBe("here");
    await age(tb, { beat_at: ago(96_000) });
    expect((await presence()).has(b)).toBe(false);
  });

  it("keeps a tab that sent its leaving beacon for 8s, and for good when it beats again (a reload)", async () => {
    const [a] = await createPlayers(["A"]);
    const tab = crypto.randomUUID();
    await beat(a, tab);
    const left = await client().rpc("leave_tab", { p_player: a, p_tab: tab });
    expect(left.error).toBeNull();
    expect((await presence()).has(a)).toBe(true);
    await age(tab, { leaving_at: ago(9_000) });
    expect((await presence()).has(a)).toBe(false);
    await beat(a, tab);
    expect((await presence()).has(a)).toBe(true);
  });

  it("reads searching from the search, and in a match from a pending or live match with its move count", async () => {
    const [a, b, c] = await createPlayers(["A", "B", "C"]);
    for (const p of [a, b, c]) await beat(p, crypto.randomUUID());
    await client().from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", c);
    await client().from("matches").insert({
      board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "in_progress", language: "is",
      started_at: new Date().toISOString(), player_a_seated_at: new Date().toISOString(), player_b_seated_at: new Date().toISOString(), player_a_moves: 6, player_b_moves: 4,
    });
    const now = await presence();
    expect(now.get(a)).toMatchObject({ state: "in_match", moves_played: 6 });
    expect(now.get(b)).toMatchObject({ state: "in_match", moves_played: 4 });
    expect(now.get(c)?.state).toBe("searching");
  });

  it("counts here (not in a match), searching, players in a match and matches on, for a lobby", async () => {
    const [a, b, c] = await createPlayers(["A", "B", "C"], "en");
    for (const p of [a, b, c]) await beat(p, crypto.randomUUID());
    await client().from("matches").insert({
      board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "in_progress", language: "en", started_at: new Date().toISOString(),
      player_a_seated_at: new Date().toISOString(), player_b_seated_at: new Date().toISOString(),
    });
    const { data, error } = await client().rpc("lobby_counts", { p_language: "en" });
    expect(error).toBeNull();
    const counts = (data as Array<Record<string, number>>)[0];
    expect(counts.here).toBeGreaterThanOrEqual(1);
    expect(counts.players_in_match).toBeGreaterThanOrEqual(2);
    expect(counts.matches_on).toBeGreaterThanOrEqual(1);
  });

  it("counts a visible tab with input in the last 30s, on any page, as attention for seating (spec 069)", async () => {
    const [a, b] = await createPlayers(["A", "B"]);
    await beat(a, crypto.randomUUID(), true, 2_000, "rules");
    await beat(b, crypto.randomUUID(), true, 45_000, "lobby");
    const attentive = async (p: string) => (await client().rpc("player_is_attentive", { p_player: p })).data;
    expect(await attentive(a)).toBe(true);
    expect(await attentive(b)).toBe(false);
  });
});
