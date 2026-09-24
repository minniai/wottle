/**
 * Spec 070 US10 (T044): the viewer's overview — the last match they played in
 * this language, with each scored word's cells and whose it was, and their
 * last ten results oldest first. Void and abandoned matches never appear.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { viewerOverview } from "@/lib/lobby/overview";

import { connectTestDb } from "./harness";

const db = await connectTestDb();
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

describe.skipIf(!db)("the viewer's overview (spec 070 US10)", () => {
  let players: string[] = [];
  const client = () => db!.client;

  async function createPlayers(names: string[]): Promise<string[]> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data, error } = await client()
      .from("players")
      .insert(names.map((n) => ({ username: `t070o-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available" })))
      .select("id, display_name");
    if (error || !data) throw new Error(`players.insert: ${error?.message}`);
    players = names.map((n) => data.find((p) => p.display_name === n)!.id as string);
    return players;
  }

  async function match(a: string, b: string, fields: Record<string, unknown>): Promise<string> {
    const { data, error } = await client()
      .from("matches")
      .insert({ board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "completed", language: "is", player_a_seated_at: at(10), player_b_seated_at: at(10), ...fields })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async function word(matchId: string, playerId: string, tiles: Array<{ x: number; y: number }>) {
    const move = await client()
      .from("match_moves")
      .insert({ match_id: matchId, player_id: playerId, global_seq: Math.floor(Math.random() * 1e6), from_x: 0, from_y: 0, to_x: 1, to_y: 0, from_letter: "A", to_letter: "B", status: "resolved" })
      .select("id")
      .single();
    if (move.error) throw new Error(move.error.message);
    const { error } = await client().from("word_score_entries").insert({
      match_id: matchId, player_id: playerId, move_id: move.data.id, word: "BORÐ", length: tiles.length, letters_points: 10, bonus_points: 10, total_points: 20, tiles,
    });
    if (error) throw new Error(error.message);
  }

  afterEach(async () => {
    const list = players.join(",");
    const { data } = await client().from("matches").select("id").or(`player_a_id.in.(${list}),player_b_id.in.(${list})`);
    const ids = (data ?? []).map((r) => r.id as string);
    if (ids.length) {
      await client().from("match_ratings").delete().in("match_id", ids);
      await client().from("word_score_entries").delete().in("match_id", ids);
      await client().from("match_moves").delete().in("match_id", ids);
      await client().from("matches").delete().in("id", ids);
    }
    await client().from("players").delete().in("id", players);
  });

  it("gives the last played match with its bands by seat, and the last ten oldest first", async () => {
    const [me, kari] = await createPlayers(["Me", "Kari"]);
    const older = await match(me, kari, { winner_id: kari, started_at: at(60), completed_at: at(55), player_a_score: 40, player_b_score: 60 });
    const last = await match(kari, me, { winner_id: me, started_at: at(20), completed_at: at(15), player_a_score: 88, player_b_score: 134 });
    await match(me, kari, { ended_reason: "void", void_reason: "left", completed_at: at(5) });
    await word(last, me, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    await word(last, kari, [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }]);
    await client().from("match_ratings").insert([
      { match_id: older, player_id: me, rating_before: 1200, rating_after: 1192, rating_delta: -8, k_factor: 32, match_result: "loss", language: "is", created_at: at(55) },
      { match_id: last, player_id: me, rating_before: 1192, rating_after: 1201, rating_delta: 9, k_factor: 32, match_result: "win", language: "is", created_at: at(15) },
    ]);

    const overview = await viewerOverview(me, "is");
    expect(overview.lastMatch).toMatchObject({ matchId: last, opponent: "Kari", you: 134, them: 88, youWon: true, durationMs: 5 * 60_000 });
    expect(overview.lastMatch!.bands).toEqual(
      expect.arrayContaining([
        { tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], seat: "you" },
        { tiles: [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }], seat: "opp" },
      ]),
    );
    expect(overview.form).toEqual(["L", "W"]);
  });

  it("has no last match for a player who has not played in this language", async () => {
    const [me, kari] = await createPlayers(["Me", "Kari"]);
    await match(me, kari, { winner_id: me, language: "en", started_at: at(20), completed_at: at(15) });
    const overview = await viewerOverview(me, "is");
    expect(overview.lastMatch).toBeNull();
    expect(overview.form).toEqual([]);
  });
});
