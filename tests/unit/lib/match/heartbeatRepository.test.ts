import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  HEARTBEAT_STALE_MS,
  recordHeartbeat,
  findStaleParticipant,
} from "@/lib/match/heartbeatRepository";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const PLAYER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PLAYER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeSelectClient(rows: Array<{ player_id: string; last_seen_at: string }>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: rows, error: null })),
      })),
    })),
  };
}

function makeUpsertClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return {
    upsert,
    client: {
      from: vi.fn(() => ({ upsert })),
    },
  };
}

describe("heartbeatRepository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
  });

  describe("recordHeartbeat", () => {
    it("upserts the (matchId, playerId) row with last_seen_at set to now", async () => {
      const { upsert, client } = makeUpsertClient();

      await recordHeartbeat(client as never, MATCH_ID, PLAYER_A);

      expect(upsert).toHaveBeenCalledWith(
        {
          match_id: MATCH_ID,
          player_id: PLAYER_A,
          last_seen_at: "2026-04-23T12:00:00.000Z",
        },
        { onConflict: "match_id,player_id" },
      );
    });
  });

  describe("findStaleParticipant", () => {
    it("returns null inside the grace window after match creation", async () => {
      // Match is 5s old, threshold is 15s → within grace → no staleness check.
      const matchCreatedAt = new Date("2026-04-23T11:59:55Z");
      const client = makeSelectClient([]);

      const stale = await findStaleParticipant(client as never, {
        matchId: MATCH_ID,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        matchCreatedAt,
      });

      expect(stale).toBeNull();
    });

    it("flags a participant whose last_seen_at is older than the stale threshold", async () => {
      const matchCreatedAt = new Date("2026-04-23T11:30:00Z");
      const client = makeSelectClient([
        { player_id: PLAYER_A, last_seen_at: "2026-04-23T11:59:58Z" }, // 2s ago — fresh
        { player_id: PLAYER_B, last_seen_at: "2026-04-23T11:59:30Z" }, // 30s ago — stale
      ]);

      const stale = await findStaleParticipant(client as never, {
        matchId: MATCH_ID,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        matchCreatedAt,
      });

      expect(stale).toBe(PLAYER_B);
    });

    it("flags a participant with no heartbeat row once past the grace window", async () => {
      const matchCreatedAt = new Date("2026-04-23T11:30:00Z");
      const client = makeSelectClient([
        { player_id: PLAYER_A, last_seen_at: "2026-04-23T11:59:58Z" },
      ]);

      const stale = await findStaleParticipant(client as never, {
        matchId: MATCH_ID,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        matchCreatedAt,
      });

      expect(stale).toBe(PLAYER_B);
    });

    it("returns null when both participants are fresh", async () => {
      const matchCreatedAt = new Date("2026-04-23T11:30:00Z");
      const client = makeSelectClient([
        { player_id: PLAYER_A, last_seen_at: "2026-04-23T11:59:58Z" },
        { player_id: PLAYER_B, last_seen_at: "2026-04-23T11:59:59Z" },
      ]);

      const stale = await findStaleParticipant(client as never, {
        matchId: MATCH_ID,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        matchCreatedAt,
      });

      expect(stale).toBeNull();
    });

    it("returns player A when only A is stale", async () => {
      const matchCreatedAt = new Date("2026-04-23T11:30:00Z");
      const client = makeSelectClient([
        { player_id: PLAYER_A, last_seen_at: "2026-04-23T11:59:30Z" },
        { player_id: PLAYER_B, last_seen_at: "2026-04-23T11:59:58Z" },
      ]);

      const stale = await findStaleParticipant(client as never, {
        matchId: MATCH_ID,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        matchCreatedAt,
      });

      expect(stale).toBe(PLAYER_A);
    });

    it("returns null on query error without throwing", async () => {
      const matchCreatedAt = new Date("2026-04-23T11:30:00Z");
      const client = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({ data: null, error: { message: "boom" } }),
            ),
          })),
        })),
      };

      const stale = await findStaleParticipant(client as never, {
        matchId: MATCH_ID,
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        matchCreatedAt,
      });

      expect(stale).toBeNull();
    });
  });

  it("exports HEARTBEAT_STALE_MS within the ≤15s acceptance criterion", () => {
    // Acceptance: surviving client sees modal within ≤15s of network drop.
    // Staleness + one 2s poll loop must stay under that.
    expect(HEARTBEAT_STALE_MS).toBeLessThanOrEqual(13_000);
    expect(HEARTBEAT_STALE_MS).toBeGreaterThanOrEqual(6_000);
  });
});
