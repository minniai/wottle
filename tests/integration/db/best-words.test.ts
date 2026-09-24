/**
 * Spec 072 T007: a profile's best words and a player's presence word.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

interface Scored {
  word: string;
  points: number;
}

async function scoreWords(matchId: string, playerId: string, words: Scored[]): Promise<void> {
  const { data: move, error } = await db!.client
    .from("match_moves")
    .insert({ match_id: matchId, player_id: playerId, global_seq: 1, from_x: 0, from_y: 0, to_x: 1, to_y: 0, from_letter: "a", to_letter: "b", status: "pending" })
    .select("id")
    .single();
  if (error || !move) throw new Error(`match_moves.insert: ${error?.message}`);
  const rows = words.map((w) => ({
    match_id: matchId,
    player_id: playerId,
    move_id: move.id,
    word: w.word,
    length: w.word.length,
    letters_points: w.points,
    bonus_points: 0,
    total_points: w.points,
    tiles: Array.from(w.word, (_, i) => ({ x: i, y: 3 })),
  }));
  const inserted = await db!.client.from("word_score_entries").insert(rows);
  if (inserted.error) throw new Error(`word_score_entries.insert: ${inserted.error.message}`);
}

describe.skipIf(!db)("best_words (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const best = async (player: string, language = "is", limit = 3) =>
    ((await db!.client.rpc("best_words", { p_player: player, p_language: language, p_limit: limit })).data ?? []) as Array<{ word: string; points: number; tiles: unknown; match_id: string }>;

  it("lists distinct words, each at its best score, highest first", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const m1 = await f.completed(birna, kari, { agoMs: 60_000 });
    const m2 = await f.completed(birna, kari);
    await scoreWords(m1, birna, [{ word: "HESTAR", points: 32 }, { word: "BORÐA", points: 21 }]);
    await scoreWords(m2, birna, [{ word: "borða", points: 29 }, { word: "SKÍRN", points: 24 }, { word: "TAK", points: 10 }]);
    const words = await best(birna);
    expect(words.map((w) => [w.word.toUpperCase(), w.points])).toEqual([["HESTAR", 32], ["BORÐA", 29], ["SKÍRN", 24]]);
    expect(words[0].tiles).toEqual(Array.from("HESTAR", (_, i) => ({ x: i, y: 3 })));
    expect(await best(birna, "is", 1)).toHaveLength(1);
  });

  it("breaks a tie in favour of the earlier match", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const earlier = await f.completed(birna, kari, { agoMs: 60_000 });
    const later = await f.completed(birna, kari);
    await scoreWords(later, birna, [{ word: "SÓL", points: 12 }]);
    await scoreWords(earlier, birna, [{ word: "SÓL", points: 12 }]);
    expect((await best(birna))[0].match_id).toBe(earlier);
  });

  it("leaves out void, abandoned and other-language matches", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const voided = await f.completed(birna, kari, { endedReason: "void" });
    await db!.client.from("matches").update({ void_reason: "left", voided_by: kari }).eq("id", voided);
    const abandoned = await f.completed(birna, kari, { endedReason: "abandoned" });
    const english = await f.completed(birna, kari, { language: "en" });
    await scoreWords(voided, birna, [{ word: "EITT", points: 40 }]);
    await scoreWords(abandoned, birna, [{ word: "TVÖ", points: 39 }]);
    await scoreWords(english, birna, [{ word: "STONE", points: 38 }]);
    expect(await best(birna)).toEqual([]);
    expect((await best(birna, "en")).map((w) => w.word)).toEqual(["STONE"]);
  });
});

describe.skipIf(!db)("presence_word (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  const word = async (player: string, language = "is") =>
    (await db!.client.rpc("presence_word", { p_player: player, p_language: language })).data as Record<string, unknown>;

  it("reads here, in a match, away, the other lobby and not here, and never a time", async () => {
    const [here, playing, away, other, gone, opponent] = await f.players_(["Here", "Playing", "Away", "Other", "Gone", "Opponent"]);
    const live = await f.match(playing, opponent, "in_progress");
    await db!.client.from("matches").update(playing < opponent ? { player_a_moves: 6 } : { player_b_moves: 6 }).eq("id", live);
    await db!.client.from("presence_tabs").update({ hidden_since: new Date(Date.now() - 180_000).toISOString() }).eq("player_id", away);
    await db!.client.from("presence_tabs").update({ language: "en" }).eq("player_id", other);
    await db!.client.from("players").update({ lobby_language: "en" }).eq("id", other);
    await db!.client.from("presence_tabs").delete().eq("player_id", gone);

    expect(await word(here)).toEqual({ state: "here", moves_played: null });
    const inMatch = await word(playing);
    expect(inMatch.state).toBe("in_match");
    expect(inMatch.moves_played).toBe(6);
    expect((await word(away)).state).toBe("away");
    expect((await word(other)).state).toBe("other_lobby");
    expect((await word(gone)).state).toBe("not_here");
    for (const id of [here, playing, away, other, gone]) {
      expect(Object.keys(await word(id)).sort()).toEqual(["moves_played", "state"]);
    }
  });

  it("reads a searching player as here", async () => {
    const [searching] = await f.players_(["Searching"], "matchmaking", "is");
    expect((await word(searching)).state).toBe("here");
  });
});
