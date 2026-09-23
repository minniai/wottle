import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({
  findActiveMatchForPlayer: vi.fn(),
}));
vi.mock("@/lib/match/createMatch", () => ({
  acceptInvite: vi.fn(),
  pairFromQueue: vi.fn(),
  inviteTtlSeconds: () => 30,
}));
vi.mock("@/lib/observability/log", () => ({
  logPlaytestInfo: vi.fn(),
  logPlaytestError: vi.fn(),
  trackInviteAccepted: vi.fn(),
}));

import { getOutgoingInvite, respondToInvite } from "@/lib/matchmaking/inviteService";
import { acceptInvite } from "@/lib/match/createMatch";

interface Call {
  table: string;
  ops: Array<[string, unknown[]]>;
}

/** A Supabase-like client that records every chained call and answers from `reply`. */
function recordingClient(reply: (call: Call) => unknown) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        then: (ok?: (v: unknown) => unknown, err?: (e: unknown) => unknown) => Promise.resolve(reply(call)).then(ok, err),
      };
      for (const op of ["select", "update", "insert", "eq", "neq", "in", "order", "lte", "limit"]) {
        chain[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return chain;
        };
      }
      for (const op of ["single", "maybeSingle"]) {
        chain[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return Promise.resolve(reply(call));
        };
      }
      return chain;
    },
  };
  return { client: client as never, calls };
}

const has = (call: Call, op: string) => call.ops.some(([name]) => name === op);
const arg = (call: Call, op: string) => call.ops.find(([name]) => name === op)?.[1];

describe("accepting a challenge (spec 067)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pendingInvite = (call: Call) =>
    call.table === "match_invitations" && has(call, "maybeSingle")
      ? { data: { id: "i2", sender_id: "silu", recipient_id: "kari", status: "pending", created_at: "" }, error: null }
      : call.table === "players"
        ? { data: { id: "silu", display_name: "Silú", username: "silu" }, error: null }
        : { data: null, error: null };

  it("accepting goes through accept_invite and opens its match (spec 067)", async () => {
    vi.mocked(acceptInvite).mockResolvedValue({ status: "created", matchId: "m1" });
    const { client } = recordingClient(pendingInvite);
    await expect(respondToInvite(client, { inviteId: "i2", actorId: "kari", decision: "accepted" })).resolves.toEqual({ status: "accepted", matchId: "m1" });
    expect(acceptInvite).toHaveBeenCalledWith(client, { inviteId: "i2", actorId: "kari" });
  });

  it("accepting a challenge whose sender is now in a match names them (spec 067 FR-019)", async () => {
    vi.mocked(acceptInvite).mockResolvedValue({ status: "busy", playerId: "silu" });
    const { client } = recordingClient(pendingInvite);
    await expect(respondToInvite(client, { inviteId: "i2", actorId: "kari", decision: "accepted" })).resolves.toEqual({ status: "busy", name: "Silú" });
  });

  it("accepting a challenge that is no longer pending says so", async () => {
    vi.mocked(acceptInvite).mockResolvedValue({ status: "not_pending" });
    const { client } = recordingClient(pendingInvite);
    await expect(respondToInvite(client, { inviteId: "i2", actorId: "kari", decision: "accepted" })).rejects.toThrow(/no longer active/);
  });

  it("the challenger reads what became of their latest challenge", async () => {
    const { client, calls } = recordingClient(() => ({
      data: { id: "i1", status: "superseded", recipient: { username: "kari", display_name: "Kári", status: "in_match" } },
      error: null,
    }));

    await expect(getOutgoingInvite(client, "nari")).resolves.toEqual({ id: "i1", status: "superseded", recipientName: "Kári", recipientInMatch: true });
    expect(calls[0].ops).toEqual(expect.arrayContaining([["eq", ["sender_id", "nari"]], ["order", ["created_at", { ascending: false }]]]));
  });

  it("no challenge sent reads as none", async () => {
    const { client } = recordingClient(() => ({ data: null, error: null }));
    await expect(getOutgoingInvite(client, "nari")).resolves.toBeNull();
  });
});
