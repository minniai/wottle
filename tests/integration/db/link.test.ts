/**
 * Spec 072 T004: making, reading, accepting, cancelling and expiring a link.
 * Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it } from "vitest";

import { connectTestDb } from "./harness";
import { acceptLink, hashHex, makeLink, newToken, readLink } from "./linkFixtures";
import { Fixtures } from "./matchCreation.fixtures";

const db = await connectTestDb();

async function linkRow(hash: string): Promise<Record<string, unknown>> {
  const { data } = await db!.client.from("match_links").select("*").eq("token_hash", hash).single();
  return data as Record<string, unknown>;
}

async function matchRow(id: string): Promise<Record<string, unknown>> {
  const { data } = await db!.client.from("matches").select("*").eq("id", id).single();
  return data as Record<string, unknown>;
}

describe.skipIf(!db)("create_link (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  it("makes a pending link in the sender's lobby language, 10 minutes long", async () => {
    const [birna] = await f.players_(["Birna"]);
    await db!.client.from("players").update({ lobby_language: "en" }).eq("id", birna);
    const { hash, result } = await makeLink(f, birna);
    expect(result.status).toBe("created");
    const ttl = Date.parse(result.expires_at as string) - Date.now();
    expect(ttl).toBeGreaterThan(598_000);
    expect(ttl).toBeLessThanOrEqual(600_500);
    const stored = await linkRow(hash);
    expect(stored).toMatchObject({ status: "pending", language: "en", sender_id: birna, id: result.link_id });
  });

  it("refuses a sender at a table or in a match", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    await f.match(birna, kari, "pending");
    expect((await makeLink(f, birna)).result.status).toBe("busy_sender");
  });

  it("refuses a sender in the table-leave cooldown", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    for (const ago of [120_000, 60_000]) {
      await db!.client.from("matches").insert({
        board_seed: crypto.randomUUID(), player_a_id: birna, player_b_id: kari, state: "completed",
        ended_reason: "void", void_reason: "left", voided_by: birna, completed_at: new Date(Date.now() - ago).toISOString(),
      });
    }
    const { result } = await makeLink(f, birna);
    expect(result.status).toBe("cooldown");
    expect(result.until).toBeTruthy();
  });

  it("counts challenges and links together, six a minute", async () => {
    const [birna, ...others] = await f.players_(["Birna", "A", "B", "C", "D", "E", "F"]);
    for (const other of others.slice(0, 5)) await f.invite(birna, other);
    await db!.client.from("match_invitations").update({ status: "withdrawn" }).eq("sender_id", birna);
    expect((await makeLink(f, birna)).result.status).toBe("created");
    expect((await makeLink(f, birna)).result.status).toBe("rate_limited");
  });

  it("withdraws the sender's challenge and earlier link, and ends their search", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const invite = await f.invite(birna, kari);
    const first = await makeLink(f, birna);
    expect(await f.statusOf("match_invitations", invite)).toBe("withdrawn");
    await db!.client.from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", birna);
    const second = await makeLink(f, birna);
    expect(second.result.status).toBe("created");
    expect((await linkRow(first.hash)).status).toBe("withdrawn");
    const { data } = await db!.client.from("players").select("status, queued_at").eq("id", birna).single();
    expect(data).toEqual({ status: "available", queued_at: null });
  });
});

describe.skipIf(!db)("read_link (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  it("names the sender and the language, and writes nothing", async () => {
    const [birna] = await f.players_(["Birna"]);
    const { hash } = await makeLink(f, birna);
    const before = await linkRow(hash);
    const read = await readLink(f, hash);
    expect(read).toMatchObject({ found: true, valid: true, sender_id: birna, sender_name: "Birna", language: "is" });
    expect(await linkRow(hash)).toEqual(before);
  });

  it("reads used, cancelled, expired and unknown links as not valid", async () => {
    const [birna] = await f.players_(["Birna"]);
    for (const status of ["used", "cancelled", "expired"]) {
      const { hash } = await makeLink(f, birna);
      await db!.client.from("match_links").update({ status }).eq("token_hash", hash);
      expect((await readLink(f, hash)).valid).toBe(false);
    }
    const past = await makeLink(f, birna);
    await db!.client.from("match_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", past.hash);
    expect((await readLink(f, past.hash)).valid).toBe(false);
    expect((await linkRow(past.hash)).status).toBe("pending");
    expect(await readLink(f, hashHex(newToken()))).toMatchObject({ found: false, valid: false });
  });
});

describe.skipIf(!db)("accept_link (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  it("creates a table from the link, seats the accepter, and waits until the link expires", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash, result: link } = await makeLink(f, birna);
    const accepted = await acceptLink(f, hash, kari);
    expect(accepted.status).toBe("created");
    const matchId = accepted.match_id as string;
    expect(await linkRow(hash)).toMatchObject({ status: "used", used_by: kari, match_id: matchId });
    const match = await matchRow(matchId);
    expect(match).toMatchObject({ state: "pending", origin: "link", origin_ref: link.link_id, language: "is" });
    expect(Date.parse(match.table_deadline_at as string)).toBe(Date.parse(link.expires_at as string));
    const kariSeat = match.player_a_id === kari ? match.player_a_seated_at : match.player_b_seated_at;
    const birnaSeat = match.player_a_id === birna ? match.player_a_seated_at : match.player_b_seated_at;
    expect(kariSeat).toBeTruthy();
    expect(birnaSeat).toBeNull();
  });

  it("does not refuse a sender who has gone (the table waits)", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash } = await makeLink(f, birna);
    await db!.client.from("presence_tabs").delete().eq("player_id", birna);
    expect((await acceptLink(f, hash, kari)).status).toBe("created");
  });

  it("is single use", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const { hash } = await makeLink(f, birna);
    expect((await acceptLink(f, hash, kari)).status).toBe("created");
    expect((await acceptLink(f, hash, embla)).status).toBe("expired");
  });

  it("tells the sender it is their own link", async () => {
    const [birna] = await f.players_(["Birna"]);
    const { hash } = await makeLink(f, birna);
    expect((await acceptLink(f, hash, birna)).status).toBe("own");
    expect((await linkRow(hash)).status).toBe("pending");
  });

  it("expires a link past its time", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash } = await makeLink(f, birna);
    await db!.client.from("match_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", hash);
    expect((await acceptLink(f, hash, kari)).status).toBe("expired");
    expect((await linkRow(hash)).status).toBe("expired");
    expect((await acceptLink(f, hashHex(newToken()), kari)).status).toBe("expired");
  });

  it("keeps the link when the accepter is busy", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const { hash } = await makeLink(f, birna);
    await f.match(kari, embla, "in_progress");
    expect((await acceptLink(f, hash, kari)).status).toBe("busy");
    expect((await linkRow(hash)).status).toBe("pending");
  });

  it("ends the link when the sender is busy", async () => {
    const [birna, kari, embla] = await f.players_(["Birna", "Kari", "Embla"]);
    const { hash } = await makeLink(f, birna);
    await db!.client.from("matches").insert({ board_seed: crypto.randomUUID(), player_a_id: birna, player_b_id: embla, state: "pending" });
    expect((await acceptLink(f, hash, kari)).status).toBe("expired");
    expect((await linkRow(hash)).status).toBe("superseded");
  });

  it("lets a player in the table-leave cooldown accept", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash } = await makeLink(f, birna);
    for (const ago of [120_000, 60_000]) {
      await db!.client.from("matches").insert({
        board_seed: crypto.randomUUID(), player_a_id: kari, player_b_id: birna, state: "completed",
        ended_reason: "void", void_reason: "left", voided_by: kari, completed_at: new Date(Date.now() - ago).toISOString(),
      });
    }
    expect((await acceptLink(f, hash, kari)).status).toBe("created");
  });
});

describe.skipIf(!db)("cancel_link and expire_links (spec 072)", () => {
  const f = new Fixtures(db!);
  afterEach(() => f.dropAll());

  it("cancels the sender's own pending link once", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const { hash, result } = await makeLink(f, birna);
    expect((await f.rpc("cancel_link", { p_sender: kari, p_link: result.link_id })).status).toBe("not_pending");
    expect((await f.rpc("cancel_link", { p_sender: birna, p_link: result.link_id })).status).toBe("cancelled");
    expect((await linkRow(hash)).status).toBe("cancelled");
    expect((await f.rpc("cancel_link", { p_sender: birna, p_link: result.link_id })).status).toBe("not_pending");
  });

  it("expires only overdue pending links", async () => {
    const [birna, kari] = await f.players_(["Birna", "Kari"]);
    const overdue = await makeLink(f, birna);
    await db!.client.from("match_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", overdue.hash);
    const fresh = await makeLink(f, kari);
    const { data } = await db!.client.rpc("expire_links");
    const rows = (data ?? []) as { link_id: string; sender_id: string }[];
    expect(rows).toContainEqual({ link_id: overdue.result.link_id, sender_id: birna });
    expect(rows.map((r) => r.link_id)).not.toContain(fresh.result.link_id);
    expect((await linkRow(overdue.hash)).status).toBe("expired");
    expect((await linkRow(fresh.hash)).status).toBe("pending");
  });
});
