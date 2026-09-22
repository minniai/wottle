import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({
  bootstrapMatchRecord: vi.fn().mockResolvedValue("match-1"),
  findActiveMatchForPlayer: vi.fn(),
}));
vi.mock("@/lib/observability/log", () => ({
  logPlaytestInfo: vi.fn(),
  logPlaytestError: vi.fn(),
  trackInviteAccepted: vi.fn(),
}));

import { getOutgoingInvite, respondToInvite } from "@/lib/matchmaking/inviteService";

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

describe("two challengers, one opponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepting one challenge declines the recipient's other pending challenges and frees their senders", async () => {
    const { client, calls } = recordingClient((call) => {
      if (call.table === "match_invitations" && has(call, "maybeSingle")) {
        return { data: { id: "i2", sender_id: "silu", recipient_id: "kari", status: "pending", created_at: "" }, error: null };
      }
      if (call.table === "match_invitations" && has(call, "neq")) return { data: [{ sender_id: "nari" }], error: null };
      return { data: null, error: null };
    });

    await respondToInvite(client, { inviteId: "i2", actorId: "kari", decision: "accepted" });

    const others = calls.find((c) => c.table === "match_invitations" && has(c, "neq"))!;
    expect(arg(others, "update")?.[0]).toMatchObject({ status: "declined" });
    expect(others.ops).toEqual(expect.arrayContaining([["eq", ["recipient_id", "kari"]], ["eq", ["status", "pending"]], ["neq", ["id", "i2"]]]));
    const freed = calls.filter((c) => has(c, "in") && (arg(c, "in") as unknown[])[1]);
    expect(freed.map((c) => [c.table, arg(c, "in")])).toEqual([
      ["players", ["id", ["nari"]]],
      ["lobby_presence", ["player_id", ["nari"]]],
    ]);
  });

  it("the challenger reads what became of their latest challenge", async () => {
    const { client, calls } = recordingClient(() => ({
      data: { id: "i1", status: "declined", recipient: { username: "kari", display_name: "Kári", status: "in_match" } },
      error: null,
    }));

    await expect(getOutgoingInvite(client, "nari")).resolves.toEqual({ id: "i1", status: "declined", recipientName: "Kári", recipientInMatch: true });
    expect(calls[0].ops).toEqual(expect.arrayContaining([["eq", ["sender_id", "nari"]], ["order", ["created_at", { ascending: false }]]]));
  });

  it("no challenge sent reads as none", async () => {
    const { client } = recordingClient(() => ({ data: null, error: null }));
    await expect(getOutgoingInvite(client, "nari")).resolves.toBeNull();
  });
});
