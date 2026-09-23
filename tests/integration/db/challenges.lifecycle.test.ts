/**
 * Spec 070 US3 (T061): a challenge's life after it is sent: withdrawn by its
 * sender, expired by the sweep, refused when its sender has gone, and answered
 * `superseded` for everyone else when a match takes a player. Live local Supabase.
 */
import { afterEach, describe, expect, it } from "vitest";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe.skipIf(!db)("a challenge's life (spec 070 US3)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());

  it("withdraws only a pending challenge, only for its sender", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    const sent = await f.send(a, b);
    const notMine = await db!.client.rpc("withdraw_challenge", { p_sender: b, p_invite: sent.invite_id });
    expect(notMine.data).toMatchObject({ status: "not_pending" });
    const mine = await db!.client.rpc("withdraw_challenge", { p_sender: a, p_invite: sent.invite_id });
    expect(mine.data).toMatchObject({ status: "withdrawn", recipient_id: b });
    const twice = await db!.client.rpc("withdraw_challenge", { p_sender: a, p_invite: sent.invite_id });
    expect(twice.data).toMatchObject({ status: "not_pending" });
  });

  it("expires challenges past their 60s and names both sides", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    const sent = await f.send(a, b);
    await db!.client.from("match_invitations").update({ expires_at: ago(1_000) }).eq("id", sent.invite_id as string);
    const { data } = await db!.client.rpc("expire_challenges");
    const mine = (data as Array<{ invite_id: string; sender_id: string; recipient_id: string }>).find((r) => r.invite_id === sent.invite_id);
    expect(mine).toMatchObject({ sender_id: a, recipient_id: b });
    expect((await f.invite(sent.invite_id as string)).status).toBe("expired");
  });

  it("refuses an accept past the expiry, and when the sender has gone ends it as left", async () => {
    const [a, b, c] = await f.players_(["A", "B", "C"]);
    const late = await f.send(a, b);
    await db!.client.from("match_invitations").update({ expires_at: ago(1_000) }).eq("id", late.invite_id as string);
    const expired = await db!.client.rpc("accept_invite", { p_invite: late.invite_id, p_actor: b, p_ttl_seconds: 60 });
    expect(expired.data).toMatchObject({ status: "expired" });

    const sent = await f.send(c, b);
    await db!.client.from("presence_tabs").update({ beat_at: ago(40_000) }).eq("player_id", c);
    const gone = await db!.client.rpc("accept_invite", { p_invite: sent.invite_id, p_actor: b, p_ttl_seconds: 60 });
    expect(gone.data).toMatchObject({ status: "gone" });
    expect((await f.invite(sent.invite_id as string)).status).toBe("left");
  });

  it("an accepted challenge supersedes the others to both players and clears an unseen result", async () => {
    const [a, b, c] = await f.players_(["A", "B", "C"]);
    const old = await db!.client.from("matches").insert({ board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: c, state: "completed", language: "is" }).select("id").single();
    await db!.client.from("players").update({ unseen_result_match_id: old.data!.id }).eq("id", a);
    const toB = await f.send(a, b);
    const fromC = await f.send(c, b);
    const accepted = await db!.client.rpc("accept_invite", { p_invite: toB.invite_id, p_actor: b, p_ttl_seconds: 60 });
    expect(accepted.data).toMatchObject({ status: "created" });
    expect((await f.invite(fromC.invite_id as string)).status).toBe("superseded");
    const { data: me } = await db!.client.from("players").select("unseen_result_match_id").eq("id", a).single();
    expect(me!.unseen_result_match_id).toBeNull();
  });
});
