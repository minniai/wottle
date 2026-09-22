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
    if (matchIds.length) await db!.client.from("matches").delete().in("id", matchIds);
    await db!.client.from("players").delete().in("id", players);
  });

  it("accepting Silú's challenge declines Nari's, frees Nari, and Nari reads that Kári took another", async () => {
    players = await createPlayers(["Nari", "Silu", "Kari"]);
    const [nari, silu, kari] = players;
    const first = await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari });
    const second = await sendDirectInvite(db!.client, { senderId: silu, recipientId: kari });

    const accepted = await respondToInvite(db!.client, { inviteId: second.inviteId, actorId: kari, decision: "accepted" });
    expect(accepted.status).toBe("accepted");

    const { data: rows } = await db!.client.from("match_invitations").select("id, status").in("id", [first.inviteId, second.inviteId]);
    expect(Object.fromEntries((rows ?? []).map((r) => [r.id, r.status]))).toEqual({ [first.inviteId]: "declined", [second.inviteId]: "accepted" });
    const { data: nariRow } = await db!.client.from("players").select("status").eq("id", nari).single();
    expect(nariRow?.status).toBe("available");
    await expect(getOutgoingInvite(db!.client, nari)).resolves.toEqual({ id: first.inviteId, status: "declined", recipientName: "Kari", recipientInMatch: true });
  });

  it("an unanswered challenge expires and its sender reads so", async () => {
    players = await createPlayers(["Nari", "Kari"]);
    const [nari, kari] = players;
    const sent = await sendDirectInvite(db!.client, { senderId: nari, recipientId: kari });
    await db!.client.from("match_invitations").update({ created_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", sent.inviteId);

    expect(await expireStaleInvites(db!.client, { ttlSeconds: 30 })).toContain(sent.inviteId);
    await expect(getOutgoingInvite(db!.client, nari)).resolves.toMatchObject({ id: sent.inviteId, status: "expired", recipientInMatch: false });
    const { data: nariRow } = await db!.client.from("players").select("status").eq("id", nari).single();
    expect(nariRow?.status).toBe("available");
  });
});
