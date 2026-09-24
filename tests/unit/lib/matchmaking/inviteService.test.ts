import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({
  findActiveMatchForPlayer: vi.fn(),
}));
vi.mock("@/lib/match/createMatch", () => ({
  pairFromQueue: vi.fn(),
  acceptInvite: vi.fn(),
  inviteTtlSeconds: () => 30,
}));
vi.mock("@/lib/observability/log", () => ({
  logPlaytestInfo: vi.fn(),
  logPlaytestError: vi.fn(),
  trackInviteAccepted: vi.fn(),
}));

import {
  selectQueueOpponent,
  startAutoQueue,
} from "@/lib/matchmaking/inviteService";
import { findActiveMatchForPlayer } from "@/lib/matchmaking/service";
import { pairFromQueue } from "@/lib/match/createMatch";

describe("inviteService helpers", () => {
  it("prefers the searcher who joined first (spec 069 FR-020)", () => {
    const candidate = selectQueueOpponent(
      [
        { id: "b", queuedAt: "2025-11-17T12:00:05Z" },
        { id: "a", queuedAt: "2025-11-17T12:00:00Z" },
        { id: "c", queuedAt: null },
      ],
      "self"
    );
    expect(candidate?.id).toBe("a");
  });

  it("returns null when no valid opponents are found", () => {
    const candidate = selectQueueOpponent(
      [{ id: "self", queuedAt: "2025-11-17T12:00:00Z" }],
      "self"
    );
    expect(candidate).toBeNull();
  });
});

const PLAYER_ID = "player-1";
const OPPONENT_ID = "opponent-1";

/**
 * Build a Supabase-like chainable mock. Every chaining method returns
 * the same object; `await chain` resolves to `resolvedValue`.
 */
function makeMockChain(resolvedValue: unknown) {
  const chain: any = {
    then: (onFulfilled?: any, onRejected?: any) =>
      Promise.resolve(resolvedValue).then(onFulfilled, onRejected),
  };
  for (const method of [
    "select",
    "update",
    "eq",
    "neq",
    "gt",
    "order",
    "upsert",
  ]) {
    chain[method] = (..._args: unknown[]) => chain;
  }
  // Terminal methods that always return a real Promise
  chain.limit = () => Promise.resolve(resolvedValue);
  chain.single = () => Promise.resolve(resolvedValue);
  return chain;
}

function makeAutoQueueClient({ opponentId = OPPONENT_ID }: { opponentId?: string } = {}) {
  let playersCallCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "players") {
        playersCallCount++;
        if (playersCallCount === 1) return makeMockChain({ data: { status: "idle" }, error: null }); // status check
        if (playersCallCount === 2) return makeMockChain({ error: null }); // join the queue
        // the candidates
        return makeMockChain({ data: [{ id: opponentId, username: "opp", queued_at: "2025-11-17T12:00:00Z" }], error: null });
      }
      return makeMockChain({ error: null });
    }),
    // No table-leave cooldown (spec 069).
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
}

describe("startAutoQueue", () => {
  beforeEach(() => {
    vi.mocked(findActiveMatchForPlayer).mockReset().mockResolvedValue(null);
    vi.mocked(pairFromQueue).mockReset().mockResolvedValue({ status: "created", matchId: "match-123" });
  });

  it("claims the searcher who joined first whatever their id (spec 069: the locks, not a tie-break, keep one match)", async () => {
    const client = makeAutoQueueClient({ opponentId: "zz-opponent" });
    const result = await startAutoQueue(client as any, { playerId: PLAYER_ID });
    expect(result.status).toBe("matched");
    expect(pairFromQueue).toHaveBeenCalledWith(client, { selfId: PLAYER_ID, opponentId: "zz-opponent", language: "is" });
  });

  it("creates the match through pair_from_queue (spec 067)", async () => {
    const client = makeAutoQueueClient();
    const result = await startAutoQueue(client as any, { playerId: PLAYER_ID });
    expect(result).toEqual({ status: "matched", matchId: "match-123" });
    expect(pairFromQueue).toHaveBeenCalledWith(client, { selfId: PLAYER_ID, opponentId: OPPONENT_ID, language: "is" });
  });

  it.each(["not_searching", "busy"] as const)("stays queued when the pairing is refused (%s)", async (status) => {
    vi.mocked(pairFromQueue).mockResolvedValue(status === "busy" ? { status, playerId: OPPONENT_ID } : { status });
    const result = await startAutoQueue(makeAutoQueueClient() as any, { playerId: PLAYER_ID });
    expect(result.status).toBe("queued");
    expect(result.matchId).toBeUndefined();
  });
});
