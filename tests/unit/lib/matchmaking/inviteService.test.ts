import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/matchmaking/service", () => ({
  bootstrapMatchRecord: vi.fn(),
  findActiveMatchForPlayer: vi.fn(),
}));
vi.mock("@/lib/observability/log", () => ({
  logPlaytestInfo: vi.fn(),
  logPlaytestError: vi.fn(),
  trackInviteAccepted: vi.fn(),
}));

import {
  calculateInviteExpiry,
  isInviteExpired,
  selectQueueOpponent,
  startAutoQueue,
} from "@/lib/matchmaking/inviteService";
import {
  bootstrapMatchRecord,
  findActiveMatchForPlayer,
} from "@/lib/matchmaking/service";

describe("inviteService helpers", () => {
  it("calculates expiry timestamps using the provided TTL", () => {
    const now = new Date("2025-11-17T12:00:00.000Z");
    const expiry = calculateInviteExpiry(now, 45);
    expect(expiry).toBe("2025-11-17T12:00:45.000Z");
  });

  it("detects expired invites based on creation time", () => {
    const now = new Date("2025-11-17T12:01:00.000Z");
    const createdAt = "2025-11-17T12:00:00.000Z";
    expect(isInviteExpired(createdAt, now, 30)).toBe(true);
    expect(isInviteExpired(createdAt, now, 90)).toBe(false);
  });

  it("prefers the oldest waiting opponent in queue arbitration", () => {
    const candidate = selectQueueOpponent(
      [
        { id: "a", lastSeenAt: "2025-11-17T12:00:00Z" },
        { id: "b", lastSeenAt: "2025-11-17T12:00:05Z" },
      ],
      "self"
    );
    expect(candidate?.id).toBe("a");
  });

  it("returns null when no valid opponents are found", () => {
    const candidate = selectQueueOpponent(
      [{ id: "self", lastSeenAt: "2025-11-17T12:00:00Z" }],
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

function makeAutoQueueClient({
  claimResult,
}: {
  claimResult: { data: { id: string }[] | null };
}) {
  let playersCallCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "players") {
        playersCallCount++;
        if (playersCallCount === 1) {
          // check player status
          return makeMockChain({
            data: { status: "idle" },
            error: null,
          });
        }
        if (playersCallCount === 2) {
          // setPlayerStatus → matchmaking
          return makeMockChain({ error: null });
        }
        if (playersCallCount === 3) {
          // fetchQueueCandidates
          return makeMockChain({
            data: [
              {
                id: OPPONENT_ID,
                username: "opp",
                last_seen_at: "2025-11-17T12:00:00Z",
              },
            ],
            error: null,
          });
        }
        if (playersCallCount === 4) {
          // atomic claim
          return makeMockChain({
            data: claimResult.data,
            error: null,
          });
        }
        // post-claim setPlayerStatus calls
        return makeMockChain({ error: null });
      }
      if (table === "lobby_presence") {
        return makeMockChain({ error: null });
      }
      return makeMockChain({ data: null, error: null });
    }),
  };
}

describe("startAutoQueue", () => {
  beforeEach(() => {
    vi.mocked(findActiveMatchForPlayer).mockReset();
    vi.mocked(bootstrapMatchRecord).mockReset();
    vi.mocked(findActiveMatchForPlayer).mockResolvedValue(null);
    vi.mocked(bootstrapMatchRecord).mockResolvedValue("match-123");
  });

  it("creates match when opponent claim succeeds", async () => {
    const client = makeAutoQueueClient({
      claimResult: { data: [{ id: OPPONENT_ID }] },
    });

    const result = await startAutoQueue(client as any, {
      playerId: PLAYER_ID,
    });

    expect(result.status).toBe("matched");
    expect(result.matchId).toBe("match-123");
    expect(bootstrapMatchRecord).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        playerAId: PLAYER_ID,
        playerBId: OPPONENT_ID,
      })
    );
  });

  it("returns queued when opponent claim fails", async () => {
    const client = makeAutoQueueClient({
      claimResult: { data: [] },
    });

    const result = await startAutoQueue(client as any, {
      playerId: PLAYER_ID,
    });

    expect(result.status).toBe("queued");
    expect(result.matchId).toBeUndefined();
    expect(bootstrapMatchRecord).not.toHaveBeenCalled();
  });
});
