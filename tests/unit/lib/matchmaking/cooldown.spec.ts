import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({ findActiveMatchForPlayer: vi.fn(async () => null) }));
vi.mock("@/lib/match/createMatch", () => ({ pairFromQueue: vi.fn(), acceptInvite: vi.fn(async () => ({ status: "created", matchId: "m1" })), inviteTtlSeconds: () => 60 }));
vi.mock("@/lib/observability/log", () => ({ logPlaytestInfo: vi.fn(), logPlaytestError: vi.fn(), trackInviteAccepted: vi.fn() }));

import { acceptInvite } from "@/lib/match/createMatch";
import { logPlaytestInfo } from "@/lib/observability/log";
import { startAutoQueue } from "@/lib/matchmaking/inviteService";

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
    expect(logPlaytestInfo).toHaveBeenCalledWith("table.cooldown", { playerId: "p1", metadata: { until: UNTIL } });
  });

  it("logs a paused search (spec 069 T067)", async () => {
    const client = clientWith(null, { players: { data: { status: "matchmaking", queued_at: null, last_seen_at: null }, error: null } });
    await expect(startAutoQueue(client as never, { playerId: "p1", language: "is", attention: { visible: false, inputAgoMs: 0 } })).resolves.toEqual({ status: "paused" });
    expect(logPlaytestInfo).toHaveBeenCalledWith("queue.paused", { playerId: "p1" });
  });
});
