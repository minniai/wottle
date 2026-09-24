/**
 * Spec 072 T005: a link is the sender's one outgoing challenge (§7.5 invariant 1).
 * Every path that withdraws a challenge withdraws a link too.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { makeLink } from "./linkFixtures";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

async function statusOf(hash: string): Promise<string> {
  const { data } = await db!.client.from("match_links").select("status").eq("token_hash", hash).single();
  return data?.status as string;
}

describe.skipIf(!db)("a link is the one outgoing challenge (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  it("sending a challenge withdraws the link", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash } = await makeLink(f, birna);
    expect((await f.rpc("send_challenge", { p_sender: birna, p_recipient: kari })).status).toBe("sent");
    expect(await statusOf(hash)).toBe("withdrawn");
  });

  it("any new match of the sender withdraws the link", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const { hash } = await makeLink(f, birna);
    const invite = await f.invite(embla, birna);
    await db!.client.from("match_invitations").update({ expires_at: new Date(Date.now() + 60_000).toISOString() }).eq("id", invite);
    expect((await f.rpc("accept_invite", { p_invite: invite, p_actor: birna, p_ttl_seconds: 60 })).status).toBe("created");
    expect(await statusOf(hash)).toBe("withdrawn");
    void kari;
  });

  it("a queue pairing withdraws the link", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash } = await makeLink(f, birna);
    const now = new Date().toISOString();
    await db!.client.from("players").update({ status: "matchmaking", queue_language: "is", queued_at: now, last_seen_at: now }).in("id", [birna, kari]);
    expect((await f.rpc("pair_from_queue", { p_self: birna, p_opponent: kari, p_language: "is" })).status).toBe("created");
    expect(await statusOf(hash)).toBe("withdrawn");
  });

  it("signing out withdraws the link", async () => {
    const [birna] = await f.players_(["Birna"]);
    const { hash } = await makeLink(f, birna);
    expect((await f.rpc("sign_out_player", { p_player: birna })).status).toBe("signed_out");
    expect(await statusOf(hash)).toBe("withdrawn");
  });

  it("a link counts as pending for a lobby switch, and the switch withdraws it", async () => {
    const [birna] = await f.players_(["Birna"]);
    await db!.client.from("players").update({ lobby_language: "is" }).eq("id", birna);
    const { hash } = await makeLink(f, birna);
    const entered = await f.rpc("enter_lobby", { p_player: birna, p_language: "en" });
    expect(entered).toMatchObject({ status: "needs_confirm" });
    expect(entered.pending).toContain("link");
    expect((await f.rpc("confirm_lobby_switch", { p_player: birna, p_language: "en" })).status).toBe("switched");
    expect(await statusOf(hash)).toBe("withdrawn");
  });

  it("links count toward the challenge limit", async () => {
    const [birna, ...others] = await f.players_(["Birna", "A", "B", "C", "D", "E", "F", "G"]);
    for (let i = 0; i < 5; i += 1) {
      const { hash } = await makeLink(f, birna);
      await db!.client.from("match_links").update({ status: "cancelled" }).eq("token_hash", hash);
    }
    expect((await f.rpc("send_challenge", { p_sender: birna, p_recipient: others[0] })).status).toBe("sent");
    expect((await f.rpc("send_challenge", { p_sender: birna, p_recipient: others[1] })).status).toBe("rate_limited");
  });
});
