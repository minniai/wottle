import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({ bootstrapMatchRecord: vi.fn(), findActiveMatchForPlayer: vi.fn() }));
vi.mock("@/lib/observability/log", () => ({ logPlaytestInfo: vi.fn(), logPlaytestError: vi.fn(), trackInviteAccepted: vi.fn() }));

import { startAutoQueue } from "@/lib/matchmaking/inviteService";
import { bootstrapMatchRecord, findActiveMatchForPlayer } from "@/lib/matchmaking/service";

type Call = { method: string; args: unknown[] };

/** A chain that records every call; `players` answers in the order startAutoQueue asks. */
function recordingClient() {
  const players: Call[][] = [];
  const answers = [
    { data: { status: "idle" }, error: null }, // status check
    { error: null }, // join the queue
    { data: [{ id: "a-opponent", username: "opp", last_seen_at: "2026-09-22T12:00:00Z" }], error: null }, // candidates
    { data: [{ id: "a-opponent" }], error: null }, // claim
  ];
  const chainFor = (calls: Call[], value: unknown) => {
    const chain: Record<string, unknown> = {
      then: (ok?: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(value).then(ok, fail),
    };
    for (const m of ["select", "update", "eq", "neq", "order", "limit", "in", "upsert", "is"]) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ method: m, args });
        return chain;
      };
    }
    chain.single = () => Promise.resolve(value);
    chain.maybeSingle = () => Promise.resolve(value);
    return chain;
  };
  const client = {
    from: vi.fn((table: string) => {
      if (table !== "players") return chainFor([], { error: null });
      const calls: Call[] = [];
      players.push(calls);
      return chainFor(calls, answers[players.length - 1] ?? { error: null });
    }),
  };
  return { client, players };
}

const has = (calls: Call[], method: string, ...args: unknown[]) =>
  calls.some((c) => c.method === method && JSON.stringify(c.args) === JSON.stringify(args));

describe("startAutoQueue by language (spec 060 FR-018)", () => {
  beforeEach(() => {
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue(null);
    vi.mocked(bootstrapMatchRecord).mockReset().mockResolvedValue("match-en");
  });

  it("joins the queue in its language, pairs only within it and creates the match in it", async () => {
    const { client, players } = recordingClient();
    const result = await startAutoQueue(client as never, { playerId: "z-player", language: "en" });

    expect(result.status).toBe("matched");
    const [, join, candidates, claim] = players;
    expect(join.find((c) => c.method === "update")?.args[0]).toMatchObject({ status: "matchmaking", queue_language: "en" });
    expect(has(candidates, "eq", "queue_language", "en")).toBe(true);
    expect(has(claim, "eq", "queue_language", "en")).toBe(true);
    expect(bootstrapMatchRecord).toHaveBeenCalledWith(client, expect.objectContaining({ language: "en" }));
  });

  it("queues in Icelandic when no language is given", async () => {
    const { client, players } = recordingClient();
    await startAutoQueue(client as never, { playerId: "z-player" });
    expect(has(players[2], "eq", "queue_language", "is")).toBe(true);
  });

  it("leaving the queue for a match clears the queue language", async () => {
    const { client, players } = recordingClient();
    await startAutoQueue(client as never, { playerId: "z-player", language: "en" });
    const claimUpdate = players[3].find((c) => c.method === "update")?.args[0];
    expect(claimUpdate).toMatchObject({ status: "in_match", queue_language: null });
  });
});
