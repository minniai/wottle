/**
 * Spec 070 US10 (T043, FR-038a): the viewer's record against each opponent,
 * in one language, over completed rated matches: void, abandoned and the
 * other language's matches never count. One query for the whole lobby.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("head to head (spec 070 US10)", () => {
  let players: string[] = [];
  const client = () => db!.client;

  async function createPlayers(names: string[]): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data, error } = await client()
      .from("players")
      .insert(names.map((n) => ({ username: `t070h-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available" })))
      .select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    players = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    return players;
  }

  async function played(a: string, b: string, winner: string | null, extra: Record<string, unknown> = {}) {
    const now = new Date().toISOString();
    const { error } = await client().from("matches").insert({
      board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "completed", language: "is",
      winner_id: winner, completed_at: now, started_at: now, player_a_seated_at: now, player_b_seated_at: now, ...extra,
    });
    if (error) throw new Error(error.message);
  }

  afterEach(async () => {
    await client().from("matches").delete().or(`player_a_id.in.(${players.join(",")}),player_b_id.in.(${players.join(",")})`);
    await client().from("players").delete().in("id", players);
  });

  it("counts wins, losses and draws against each opponent, from either seat", async () => {
    const [me, kari, embla] = await createPlayers(["Me", "Kari", "Embla"]);
    await played(me, kari, me);
    await played(kari, me, me);
    await played(me, kari, kari);
    await played(me, kari, null);
    await played(embla, me, embla);
    const { data, error } = await client().rpc("head_to_head", { p_viewer: me, p_language: "is" });
    expect(error).toBeNull();
    const byOpponent = new Map((data as Array<{ opponent_id: string; wins: number; losses: number; draws: number }>).map((r) => [r.opponent_id, r]));
    expect(byOpponent.get(kari)).toMatchObject({ wins: 2, losses: 1, draws: 1 });
    expect(byOpponent.get(embla)).toMatchObject({ wins: 0, losses: 1, draws: 0 });
  });

  it("never counts a void table, an abandoned match or the other language", async () => {
    const [me, kari] = await createPlayers(["Me", "Kari"]);
    await played(me, kari, me, { ended_reason: "void", void_reason: "left", winner_id: null });
    await played(me, kari, null, { state: "abandoned", ended_reason: "abandoned" });
    await played(me, kari, me, { language: "en" });
    const { data } = await client().rpc("head_to_head", { p_viewer: me, p_language: "is" });
    expect(data).toEqual([]);
  });
});
