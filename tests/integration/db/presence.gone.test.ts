/**
 * Spec 070 US6 (T032): a player with no fresh tab is gone. The sweep cancels
 * their search and ends their pending challenges, sent and received, as `left`.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe.skipIf(!db)("settling gone players (spec 070 US6)", () => {
  let players: string[] = [];
  const client = () => db!.client;

  async function createPlayers(names: string[]): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data, error } = await client()
      .from("players")
      .insert(names.map((n) => ({ username: `t070g-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available", lobby_language: "is" })))
      .select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    const ids = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    players.push(...ids);
    return ids;
  }

  afterEach(async () => {
    await client().from("match_invitations").delete().or(`sender_id.in.(${players.join(",")}),recipient_id.in.(${players.join(",")})`);
    await client().from("presence_tabs").delete().in("player_id", players);
    await client().from("players").delete().in("id", players);
    players = [];
  });

  it("cancels a gone player's search and ends their challenges as left, and leaves a present one alone", async () => {
    const [gone, here, other] = await createPlayers(["Gone", "Here", "Other"]);
    const staleTab = crypto.randomUUID();
    await client().rpc("beat_tab", { p_player: gone, p_tab: staleTab, p_visible: true, p_input_ago_ms: 0, p_page: "lobby" });
    await client().from("presence_tabs").update({ beat_at: ago(40_000) }).eq("tab_id", staleTab);
    for (const p of [here, other]) await client().rpc("beat_tab", { p_player: p, p_tab: crypto.randomUUID(), p_visible: true, p_input_ago_ms: 0, p_page: "lobby" });
    await client().from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", gone);
    await client().from("match_invitations").insert([
      { sender_id: gone, recipient_id: here, status: "pending", language: "is" },
      { sender_id: other, recipient_id: gone, status: "pending", language: "is" },
      { sender_id: here, recipient_id: other, status: "pending", language: "is" },
    ]);

    const { data, error } = await client().rpc("settle_gone_players");
    expect(error).toBeNull();
    const rows = (data as Array<{ player_id: string; counterpart_id: string | null }>).filter((r) => players.includes(r.player_id));
    expect([...new Set(rows.map((r) => r.player_id))]).toEqual([gone]);
    // Each counterpart is named, so the sweep can tell them what became of the challenge.
    expect(rows.map((r) => r.counterpart_id).filter(Boolean).sort()).toEqual([here, other].sort());

    const { data: me } = await client().from("players").select("status, queue_language, queued_at").eq("id", gone).single();
    expect(me).toMatchObject({ status: "available", queue_language: null, queued_at: null });
    const { data: invites } = await client().from("match_invitations").select("sender_id, recipient_id, status, responded_at").in("sender_id", players);
    const byPair = (s: string, r: string) => invites!.find((i) => i.sender_id === s && i.recipient_id === r)!;
    expect(byPair(gone, here)).toMatchObject({ status: "left" });
    expect(byPair(gone, here).responded_at).not.toBeNull();
    expect(byPair(other, gone)).toMatchObject({ status: "left" });
    expect(byPair(here, other).status).toBe("pending");
  });
});
