/**
 * Spec 070 T083: the standing read. A call shows its sender with their rating
 * and your record; your challenge shows until its outcome is 10s old; a decline
 * leaves a 60s cooldown on the pair; a table or a running match is your match;
 * the topic is your HMAC topic. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { topicFor } from "@/lib/realtime/pokes";
import { readStanding } from "@/lib/standing/readStanding";
import { standingFactsSchema } from "@/lib/types/standing";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();
process.env.WOTTLE_SESSION_SECRET ??= Buffer.alloc(32, 3).toString("base64");

describe.skipIf(!db)("the standing read (spec 070 US4)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());

  it("shows a call to the recipient and the challenge to its sender, then the decline's cooldown", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    const sent = await f.send(a, b);
    const forB = standingFactsSchema.parse(await readStanding(b));
    expect(forB.topic).toBe(topicFor(b));
    expect(forB.incoming).toHaveLength(1);
    expect(forB.incoming[0]).toMatchObject({ inviteId: sent.invite_id, from: { playerId: a, displayName: "A", state: "here" } });
    const forA = await readStanding(a);
    expect(forA.outgoing).toMatchObject({ inviteId: sent.invite_id, status: "pending", to: { playerId: b } });

    await db!.client.from("match_invitations").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", sent.invite_id as string);
    const after = await readStanding(a);
    expect(after.outgoing?.status).toBe("declined");
    expect(after.cooldowns).toEqual([{ playerId: b, until: expect.any(String) }]);
    expect((await readStanding(b)).incoming).toEqual([]);
  });

  it("names a table or a running match as the viewer's match, and the search when there is one", async () => {
    const [a, b, c] = await f.players_(["A", "B", "C"]);
    await db!.client.from("matches").insert({ board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "pending", language: "is" });
    expect((await readStanding(a)).match).toMatchObject({ kind: "table", opponent: "B" });
    await db!.client.from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", c);
    expect((await readStanding(c)).search).toMatchObject({ paused: false });
  });

  it("names a match that ended while the viewer was away, until it is opened", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    const { data: m } = await db!.client
      .from("matches")
      .insert({ board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: b, state: "completed", language: "is", winner_id: b, player_a_score: 46, player_b_score: 88, ended_reason: "moves_complete" })
      .select("id")
      .single();
    await db!.client.from("players").update({ unseen_result_match_id: m!.id }).eq("id", a);
    expect((await readStanding(a)).match).toMatchObject({ kind: "over", winner: "opponent", winnerName: "B", you: 46, them: 88 });
  });
});
