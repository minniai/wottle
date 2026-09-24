/**
 * Spec 070 US8 (T103): a player in a live match whose app is open on another
 * page keeps the match's heartbeat, marked `page`, so the opponent reads
 * `stepped out`. A fresh beat from the match page itself is never overwritten.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { readParticipants } from "@/lib/match/heartbeatRepository";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("stepped out (spec 070 US8)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());

  async function liveMatch(): Promise<{ a: string; b: string; matchId: string }> {
    const [a, b] = await f.players_(["A", "B"], "is");
    const { data } = await db!.client.rpc("create_match_between", { p_a: a, p_b: b, p_language: "is", p_origin: "challenge", p_ref: null });
    const matchId = (data as { match_id: string }).match_id;
    const past = new Date(Date.now() - 60_000).toISOString();
    await db!.client.from("matches").update({ state: "in_progress", created_at: past, started_at: past }).eq("id", matchId);
    return { a, b, matchId };
  }
  const heartbeat = async (matchId: string, player: string) =>
    (await db!.client.from("match_heartbeats").select("source, cadence_ms").eq("match_id", matchId).eq("player_id", player).maybeSingle()).data;

  it("a page beat keeps the live match's heartbeat and reads as stepped out, not stale", async () => {
    const { a, b, matchId } = await liveMatch();
    await db!.client.from("match_heartbeats").insert({ match_id: matchId, player_id: b, last_seen_at: new Date().toISOString(), source: "match", cadence_ms: 2000 });
    const { data } = await db!.client.rpc("beat_match_from_page", { p_player: a, p_cadence_ms: 10_000 });
    expect(data).toBe(matchId);
    expect(await heartbeat(matchId, a)).toEqual({ source: "page", cadence_ms: 10_000 });
    const { data: row } = await db!.client.from("matches").select("created_at").eq("id", matchId).single();
    const read = await readParticipants(db!.client, { matchId, playerAId: a, playerBId: b, matchCreatedAt: new Date(row!.created_at) });
    expect(read).toEqual({ stale: null, steppedOut: a });
  });

  it("never overwrites a fresh beat from the match page", async () => {
    const { a, matchId } = await liveMatch();
    await db!.client.from("match_heartbeats").insert({ match_id: matchId, player_id: a, last_seen_at: new Date().toISOString(), source: "match", cadence_ms: 2000 });
    await db!.client.rpc("beat_match_from_page", { p_player: a, p_cadence_ms: 10_000 });
    expect(await heartbeat(matchId, a)).toEqual({ source: "match", cadence_ms: 2000 });
  });

  it("does nothing without a live match", async () => {
    const [a] = await f.players_(["A"], "is");
    const { data } = await db!.client.rpc("beat_match_from_page", { p_player: a, p_cadence_ms: 10_000 });
    expect(data).toBeNull();
  });
});

describe.skipIf(!db)("match over while away (spec 070 US8)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());

  it("marks the result unseen for a player not on the match page, and clears it when opened", async () => {
    const [a, b] = await f.players_(["A", "B"], "is");
    const { data } = await db!.client.rpc("create_match_between", { p_a: a, p_b: b, p_language: "is", p_origin: "challenge", p_ref: null });
    const matchId = (data as { match_id: string }).match_id;
    await db!.client.from("match_heartbeats").insert({ match_id: matchId, player_id: b, last_seen_at: new Date().toISOString(), source: "match", cadence_ms: 2000 });
    await db!.client.from("match_heartbeats").insert({ match_id: matchId, player_id: a, last_seen_at: new Date().toISOString(), source: "page", cadence_ms: 10_000 });
    await db!.client.from("matches").update({ state: "completed", ended_reason: "moves_complete", completed_at: new Date().toISOString() }).eq("id", matchId);
    const { data: away } = await db!.client.rpc("mark_unseen_result", { p_match: matchId });
    expect(away).toEqual([a]);
    const unseen = async (p: string) => (await db!.client.from("players").select("unseen_result_match_id").eq("id", p).single()).data!.unseen_result_match_id;
    expect(await unseen(a)).toBe(matchId);
    expect(await unseen(b)).toBeNull();
    await db!.client.rpc("clear_unseen_result", { p_player: a, p_match: matchId });
    expect(await unseen(a)).toBeNull();
  });
});
