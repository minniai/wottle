import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({ findActiveMatchForPlayer: vi.fn(async () => null) }));
vi.mock("@/lib/match/createMatch", () => ({ pairFromQueue: vi.fn(), acceptInvite: vi.fn(async () => ({ status: "created", matchId: "m1" })), inviteTtlSeconds: () => 60 }));
vi.mock("@/lib/observability/log", () => ({ logPlaytestInfo: vi.fn(), logPlaytestError: vi.fn(), trackInviteAccepted: vi.fn() }));

import { acceptInvite } from "@/lib/match/createMatch";
import { respondToInvite, sendDirectInvite, startAutoQueue } from "@/lib/matchmaking/inviteService";

/** Spec 069 US5 (T053): two table leaves in 10 minutes refuse searching and sending; accepting stays open (Q1). */
const UNTIL = "2026-09-23T12:05:00.000Z";

function clientWith(until: string | null, rows: Record<string, unknown> = {}) {
  const chain = (value: unknown) => {
    const c: Record<string, unknown> = { then: (ok?: (v: unknown) => unknown) => Promise.resolve(value).then(ok) };
    for (const m of ["select", "update", "eq", "neq", "gt", "in", "order", "limit", "is", "not"]) c[m] = () => c;
    c.single = async () => value;
    c.maybeSingle = async () => value;
    return c;
  };
  return {
    rpc: vi.fn(async () => ({ data: until, error: null })),
    from: vi.fn((table: string) => chain(rows[table] ?? { data: null, error: null })),
  };
}

describe("the table-leave cooldown (spec 069 US5)", () => {
  beforeEach(() => {
    vi.mocked(acceptInvite).mockClear();
  });

  it("refuses a search with the time it ends", async () => {
    const client = clientWith(UNTIL, { players: { data: { status: "available", queued_at: null, last_seen_at: null }, error: null } });
    await expect(startAutoQueue(client as never, { playerId: "p1", language: "is" })).resolves.toEqual({ status: "cooldown", until: UNTIL });
  });

  it("refuses sending a challenge with the time it ends", async () => {
    const client = clientWith(UNTIL);
    await expect(sendDirectInvite(client as never, { senderId: "p1", recipientId: "p2", language: "is" })).resolves.toEqual({ status: "cooldown", until: UNTIL });
  });

  it("never refuses accepting a challenge", async () => {
    const invite = { id: "i1", sender_id: "p2", recipient_id: "p1", status: "pending", created_at: new Date().toISOString(), language: "is" };
    const client = clientWith(UNTIL, { match_invitations: { data: invite, error: null } });
    await respondToInvite(client as never, { inviteId: "i1", actorId: "p1", decision: "accepted" });
    expect(acceptInvite).toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalledWith("table_leave_cooldown_until", expect.anything());
  });
});
