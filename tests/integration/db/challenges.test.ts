/**
 * Spec 070 US3 (T060): sending a challenge. One locked function decides every
 * gate, withdraws the sender's other challenge and search, starts a crossed
 * pair at once, and counts every limit from stored rows. Live local Supabase.
 */
import { afterEach, describe, expect, it } from "vitest";

import { ChallengeFixtures } from "./challengeFixtures";
import { connectTestDb } from "./harness";

const db = await connectTestDb();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe.skipIf(!db)("send_challenge (spec 070 US3)", () => {
  const f = new ChallengeFixtures(db!);
  afterEach(() => f.dropAll());

  it("records a 60s challenge, withdraws the sender's other one and search, and leaves the sender's status alone", async () => {
    const [a, b, c] = await f.players_(["A", "B", "C"]);
    const first = await f.send(a, c);
    expect(first.status).toBe("sent");
    await db!.client.from("players").update({ status: "matchmaking", queue_language: "is", queued_at: new Date().toISOString() }).eq("id", a);
    const second = await f.send(a, b);
    expect(second).toMatchObject({ status: "sent" });
    const invite = await f.invite(second.invite_id as string);
    const ttl = Date.parse(invite.expires_at as string) - Date.parse(invite.created_at as string);
    expect(ttl).toBeGreaterThanOrEqual(59_000);
    expect(ttl).toBeLessThanOrEqual(61_000);
    expect((await f.invite(first.invite_id as string)).status).toBe("withdrawn");
    const { data: me } = await db!.client.from("players").select("status, queue_language").eq("id", a).single();
    expect(me).toMatchObject({ status: "available", queue_language: null });
    const { data: lp } = await db!.client.from("lobby_presence").select("mode").eq("player_id", a).single();
    expect(lp!.mode).toBe("auto");
    expect(second.withdrawn_from).toEqual([c]);
  });

  it("refuses a player at a table or in a match, and a sender who is", async () => {
    const [a, b, c, d] = await f.players_(["A", "B", "C", "D"]);
    await db!.client.from("matches").insert({ board_seed: crypto.randomUUID(), player_a_id: b, player_b_id: c, state: "pending", language: "is" });
    expect((await f.send(a, b)).status).toBe("in_match");
    expect((await f.send(c, d)).status).toBe("busy_sender");
  });

  it("refuses someone gone, someone away, another lobby, and yourself", async () => {
    const [a, gone, away] = await f.players_(["A", "Gone", "Away"]);
    const [english] = await f.players_(["En"], "en");
    await db!.client.from("presence_tabs").update({ beat_at: ago(40_000) }).eq("player_id", gone);
    await db!.client.from("presence_tabs").update({ visible: false, hidden_since: ago(125_000), cadence_ms: 30_000 }).eq("player_id", away);
    expect((await f.send(a, gone)).status).toBe("gone");
    expect((await f.send(a, away)).status).toBe("away");
    expect((await f.send(a, english)).status).toBe("other_lobby");
    expect((await f.send(a, a)).status).toBe("self");
  });

  it("refuses the same pair for 60s after a decline, with the time it ends", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    const sent = await f.send(a, b);
    await db!.client.from("match_invitations").update({ status: "declined", responded_at: ago(8_000) }).eq("id", sent.invite_id as string);
    const again = await f.send(a, b);
    expect(again.status).toBe("declined_recently");
    expect(Date.parse(again.until as string) - Date.now()).toBeGreaterThan(50_000);
    await db!.client.from("match_invitations").update({ responded_at: ago(61_000) }).eq("id", sent.invite_id as string);
    expect((await f.send(a, b)).status).toBe("sent");
  });

  it("allows six challenges a minute and refuses the seventh", async () => {
    const [a, ...others] = await f.players_(["A", "B1", "B2", "B3", "B4", "B5", "B6", "B7"]);
    for (const other of others.slice(0, 6)) expect((await f.send(a, other)).status).toBe("sent");
    expect((await f.send(a, others[6])).status).toBe("rate_limited");
  });

  it("refuses during the table-leave cooldown (spec 069)", async () => {
    const [a, b, c] = await f.players_(["A", "B", "C"]);
    for (const leftAgo of [4 * 60_000, 60_000]) {
      await db!.client.from("matches").insert({
        board_seed: crypto.randomUUID(), player_a_id: a, player_b_id: c, state: "completed", language: "is",
        ended_reason: "void", void_reason: "left", voided_by: a, completed_at: ago(leftAgo),
      });
    }
    const refused = await f.send(a, b);
    expect(refused.status).toBe("cooldown");
    expect(refused.until).toBeTruthy();
  });

  it("starts the match at once when the other had already challenged the sender", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    await f.send(b, a);
    const crossed = await f.send(a, b);
    expect(crossed.status).toBe("crossed");
    const { data: m } = await db!.client.from("matches").select("origin, player_a_seated_at, player_b_seated_at").eq("id", crossed.match_id as string).single();
    expect(m!.origin).toBe("crossed_challenge");
    expect(m!.player_a_seated_at).not.toBeNull();
    expect(m!.player_b_seated_at).not.toBeNull();
  });

  it("silences a challenger declined three times in 10 minutes: sent to them, declined to the other", async () => {
    const [a, b] = await f.players_(["A", "B"]);
    for (const minutesAgo of [9, 6, 3]) {
      await db!.client.from("match_invitations").insert({ sender_id: a, recipient_id: b, status: "declined", language: "is", responded_at: ago(minutesAgo * 60_000), created_at: ago(minutesAgo * 60_000 + 5_000) });
    }
    const silenced = await f.send(a, b);
    expect(silenced.status).toBe("sent");
    const row = await f.invite(silenced.invite_id as string);
    expect(row).toMatchObject({ status: "declined", auto_declined: true });
    expect(row.responded_at).not.toBeNull();
  });
});
