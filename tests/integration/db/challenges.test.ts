/**
 * Two challengers, one opponent (2026-09-22): accepting one challenge answers
 * the others and frees their senders; an unanswered one expires; each sender
 * reads what became of theirs. Live local Supabase; skips without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { expireStaleInvites, getOutgoingInvite, respondToInvite, sendDirectInvite } from "@/lib/matchmaking/inviteService";

import { connectTestDb } from "./harness";

const db = await connectTestDb();

function sentId(result: Awaited<ReturnType<typeof sendDirectInvite>>): string {
  if (result.status !== "sent") throw new Error(`expected a sent challenge, got ${result.status}`);
  return result.inviteId;
}

async function createPlayers(names: string[]): Promise<string[]> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const { data, error } = await db!.client
    .from("players")
    .insert(names.map((n) => ({ username: `tch-${n.toLowerCase()}-${suffix}`, display_name: n, status: "available" })))
    .select("id, display_name");
  if (error || !data) throw new Error(`players.insert: ${error?.message}`);
  return names.map((n) => data.find((p) => p.display_name === n)!.id as string);
}

describe.skipIf(!db)("challenges (2026-09-22)", () => {
  let players: string[] = [];

  afterEach(async () => {
    const { data } = await db!.client.from("match_invitations").select("match_id").in("recipient_id", players);
    const matchIds = (data ?? []).map((r) => r.match_id).filter(Boolean);
    await db!.client.from("match_invitations").delete().in("sender_id", players);
    if (matchIds.length) await db!.client.from("matches").delete().in("id", matchIds);
    await db!.client.from("players").delete().in("id", players);
  });

  it("accepting Silú's challenge supersedes Nari's, and Nari reads that Kári took another", async () => {
    players = await createPlayers(["Nari", "Silu", "Kari"]);
    const [nari, silu, kari] = players;
    const first = sentId(await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari }));
    const second = sentId(await sendDirectInvite(db!.client, { senderId: silu, recipientId: kari }));

    const accepted = await respondToInvite(db!.client, { inviteId: second, actorId: kari, decision: "accepted" });
    expect(accepted.status).toBe("accepted");

    const { data: rows } = await db!.client.from("match_invitations").select("id, status").in("id", [first, second]);
    expect(Object.fromEntries((rows ?? []).map((r) => [r.id, r.status]))).toEqual({ [first]: "superseded", [second]: "accepted" });
    const { data: nariRow } = await db!.client.from("players").select("status").eq("id", nari).single();
    expect(nariRow?.status).toBe("available");
    await expect(getOutgoingInvite(db!.client, nari)).resolves.toEqual({ id: first, status: "superseded", recipientName: "Kari", recipientInMatch: true });
  });

  it("sending a challenge never marks the sender, so they can still be challenged back (spec 067)", async () => {
    players = await createPlayers(["Nari", "Kari"]);
    const [nari, kari] = players;
    sentId(await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari }));
    const { data: nariRow } = await db!.client.from("players").select("status").eq("id", nari).single();
    expect(nariRow?.status).toBe("available");
  });

  it("challenging someone whose challenge to you is pending starts the match at once (spec 067)", async () => {
    players = await createPlayers(["Nari", "Kari"]);
    const [nari, kari] = players;
    const first = sentId(await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari }));
    const crossed = await sendDirectInvite(db!.client, { senderId: kari, recipientId: nari });

    expect(crossed.status).toBe("accepted");
    const matchId = crossed.status === "accepted" ? crossed.matchId : "";
    const { data: match } = await db!.client.from("matches").select("origin, player_a_id, player_b_id").eq("id", matchId).single();
    expect(match).toEqual({ origin: "crossed_challenge", player_a_id: nari, player_b_id: kari });
    const { data: row } = await db!.client.from("match_invitations").select("status").eq("id", first).single();
    expect(row?.status).toBe("accepted");
  });

  it("accepting a challenge from someone now in another match is refused and names them (spec 067)", async () => {
    players = await createPlayers(["Nari", "Silu", "Kari"]);
    const [nari, silu, kari] = players;
    const stale = sentId(await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari }));
    const fresh = sentId(await sendDirectInvite(db!.client, { senderId: nari, recipientId: silu }));
    await respondToInvite(db!.client, { inviteId: fresh, actorId: silu, decision: "accepted" });

    await expect(respondToInvite(db!.client, { inviteId: stale, actorId: kari, decision: "accepted" })).rejects.toThrow(/no longer active/);
    const { data: m } = await db!.client.from("matches").select("id").or(`player_a_id.eq.${kari},player_b_id.eq.${kari}`);
    expect(m).toEqual([]);
  });

  it("an unanswered challenge expires and its sender reads so", async () => {
    players = await createPlayers(["Nari", "Kari"]);
    const [nari, kari] = players;
    const sent = sentId(await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari }));
    await db!.client.from("match_invitations").update({ created_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", sent);

    expect(await expireStaleInvites(db!.client, { ttlSeconds: 30 })).toContain(sent);
    await expect(getOutgoingInvite(db!.client, nari)).resolves.toMatchObject({ id: sent, status: "expired", recipientInMatch: false });
    const { data: nariRow } = await db!.client.from("players").select("status").eq("id", nari).single();
    expect(nariRow?.status).toBe("available");
  });
});
