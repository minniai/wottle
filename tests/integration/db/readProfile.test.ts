/**
 * Spec 072 T059: a profile read from the database, in one language, never
 * carrying a last-seen time. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { playerIdForHandle, readProfile } from "@/lib/profile/readProfile";

import { connectTestDb } from "./harness";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();
const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe.skipIf(!db)("readProfile (spec 072)", () => {
  const f = new Fixtures(db!);
  const rated_: string[] = [];
  afterEach(async () => {
    // Ratings hold their matches; they go first.
    if (rated_.length) await db!.client.from("match_ratings").delete().in("match_id", rated_.splice(0));
    await f.dropAll();
  });

  async function rated(player: string, opponent: string, result: "win" | "loss" | "draw", before: number, after: number, ago: number, language: "is" | "en" = "is") {
    const match = await f.completed(player, opponent, { agoMs: ago * 86_400_000, language });
    await db!.client.from("matches").update({ winner_id: result === "win" ? player : result === "loss" ? opponent : null, player_a_score: 50, player_b_score: 40 }).eq("id", match);
    const { error } = await db!.client.from("match_ratings").insert({
      match_id: match, player_id: player, rating_before: before, rating_after: after, rating_delta: after - before, k_factor: 32, match_result: result, created_at: daysAgo(ago), language,
    });
    if (error) throw new Error(error.message);
    rated_.push(match);
    return match;
  }

  it("reads the rating, record, form, week, peak and chart in this language", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    await rated(birna, kari, "win", 1200, 1216, 20);
    await rated(birna, kari, "loss", 1216, 1196, 10);
    await rated(birna, kari, "win", 1196, 1212, 2);
    await rated(birna, kari, "win", 1200, 1216, 5, "en");
    await db!.client.from("player_ratings").upsert([
      { player_id: birna, language: "is", elo_rating: 1212, games_played: 3, wins: 2, losses: 1, draws: 0 },
      { player_id: birna, language: "en", elo_rating: 1216, games_played: 1, wins: 1, losses: 0, draws: 0 },
    ]);
    const view = (await readProfile(birna, "is", { kind: "own" }, NOW))!;
    expect(view).toMatchObject({ rating: 1212, peak: 1216, matches: 3, weekChange: 16, lastTen: ["W", "L", "W"] });
    expect(view.record).toEqual({ won: 2, lost: 1, drawn: 0, winRate: 2 / 3 });
    expect(view.chart.map((p) => p.rating)).toEqual([1200, 1216, 1196, 1212, 1212]);
    expect(view.otherLanguage).toEqual({ language: "en", rating: 1216, matches: 1 });
    expect(view.matchesList).toHaveLength(3);
    expect(view.presence).toBeNull();
  });

  it("reads a new player plainly", async () => {
    const [embla] = await f.players_(["Embla"]);
    const view = (await readProfile(embla, "en", { kind: "own" }, NOW))!;
    expect(view).toMatchObject({ rating: 1200, matches: 0, firstPlayedAt: null, lastTen: [], bestWords: [], matchesList: [] });
    expect(view.record.winRate).toBeNull();
  });

  it("lists only the viewer's matches against the owner on a public profile, with a presence word", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    await rated(kari, birna, "win", 1200, 1210, 3);
    await rated(kari, embla, "loss", 1210, 1200, 2);
    const view = (await readProfile(kari, "is", { kind: "public", viewerId: birna }, NOW))!;
    expect(view.matchesList.map((m) => m.opponentId)).toEqual([birna]);
    expect(view.presence).toEqual({ state: "here", movesPlayed: null });
    expect((await readProfile(kari, "is", { kind: "public", viewerId: null }, NOW))!.matchesList).toEqual([]);
  });

  it("never carries a last-seen time, a status or an avatar", async () => {
    const [birna] = await f.players_(["Birna"]);
    const json = JSON.stringify(await readProfile(birna, "is", { kind: "public", viewerId: null }, NOW));
    expect(json).not.toMatch(/last_seen|lastSeen|avatar|"status"/);
  });

  it("finds a player by handle, encoded or not", async () => {
    const [kari] = await f.players_(["Kári"]);
    const { data } = await db!.client.from("players").select("username").eq("id", kari).single();
    const handle = data!.username as string;
    expect(await playerIdForHandle(encodeURIComponent(handle))).toBe(kari);
    expect(await playerIdForHandle(handle.toUpperCase())).toBe(kari);
    expect(await playerIdForHandle("nobody-here-at-all")).toBeNull();
  });
});
