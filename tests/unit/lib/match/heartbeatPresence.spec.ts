import { describe, expect, it } from "vitest";

import { readParticipants } from "@/lib/match/heartbeatRepository";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const CREATED = new Date(NOW.getTime() - 120_000);

function client(rows: Array<{ player_id: string; last_seen_at: string; source: string; cadence_ms: number }>) {
  return { from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }) } as never;
}
const opts = { matchId: "m", playerAId: "a", playerBId: "b", matchCreatedAt: CREATED, now: NOW };

/** Spec 070 US8 (T103): a player on a page is stepped out, never reconnecting, while their page beats. */
describe("readParticipants", () => {
  it("reports nobody when both beat from the match", async () => {
    const r = await readParticipants(client([{ player_id: "a", last_seen_at: ago(1_000), source: "match", cadence_ms: 2_000 }, { player_id: "b", last_seen_at: ago(2_000), source: "match", cadence_ms: 2_000 }]), opts);
    expect(r).toEqual({ stale: null, steppedOut: null });
  });

  it("reports a player beating from a page as stepped out, fresh by the page's own cadence", async () => {
    const r = await readParticipants(client([{ player_id: "a", last_seen_at: ago(1_000), source: "match", cadence_ms: 2_000 }, { player_id: "b", last_seen_at: ago(28_000), source: "page", cadence_ms: 10_000 }]), opts);
    expect(r).toEqual({ stale: null, steppedOut: "b" });
  });

  it("counts reconnecting only when neither the match nor a page has heard from them", async () => {
    const r = await readParticipants(client([{ player_id: "a", last_seen_at: ago(1_000), source: "match", cadence_ms: 2_000 }, { player_id: "b", last_seen_at: ago(40_000), source: "page", cadence_ms: 10_000 }]), opts);
    expect(r.steppedOut).toBeNull();
    expect(r.stale?.playerId).toBe("b");
  });
});
