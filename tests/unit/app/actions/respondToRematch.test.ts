import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/matchmaking/profile", () => ({
  readLobbySession: vi.fn(),
}));
vi.mock("@/lib/rate-limiting/middleware", () => ({
  assertWithinRateLimit: vi.fn(),
}));
vi.mock("@/lib/match/logWriter", () => ({
  writeMatchLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/match/rematchBroadcast", () => ({
  broadcastRematchEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/match/rematchRepository", () => ({
  fetchRematchRequest: vi.fn(),
  updateRematchRequestStatus: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/matchmaking/service", () => ({
  bootstrapMatchRecord: vi.fn(),
}));

import { respondToRematchAction } from "@/app/actions/match/respondToRematch";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  fetchRematchRequest,
  updateRematchRequestStatus,
} from "@/lib/match/rematchRepository";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import { bootstrapMatchRecord } from "@/lib/matchmaking/service";
import { writeMatchLog } from "@/lib/match/logWriter";

const PLAYER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PLAYER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MATCH_ID = "11111111-1111-1111-1111-111111111111";

function mockSession(playerId: string) {
  vi.mocked(readLobbySession).mockResolvedValue({
    player: { id: playerId, username: "test", displayName: "Test" },
  } as any);
}

function makeSupabaseMock() {
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => updateChain),
    })),
  };
}

function makePendingRequest(createdAt?: string) {
  return {
    id: "req-1",
    matchId: MATCH_ID,
    requesterId: PLAYER_A,
    responderId: PLAYER_B,
    status: "pending" as const,
    newMatchId: null,
    createdAt: createdAt ?? new Date().toISOString(),
    respondedAt: null,
  };
}

describe("respondToRematchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts rematch and returns new match ID", async () => {
    mockSession(PLAYER_B);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue(makePendingRequest());
    vi.mocked(bootstrapMatchRecord).mockResolvedValue("new-match-1");

    const result = await respondToRematchAction(MATCH_ID, true);

    expect(result).toEqual({ status: "accepted", matchId: "new-match-1" });
    expect(bootstrapMatchRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        playerAId: PLAYER_A,
        playerBId: PLAYER_B,
        rematchOf: MATCH_ID,
      }),
    );
    expect(updateRematchRequestStatus).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      "accepted",
      "new-match-1",
    );
    expect(broadcastRematchEvent).toHaveBeenCalledWith(
      MATCH_ID,
      expect.objectContaining({ type: "rematch-accepted" }),
    );
  });

  it("declines rematch and returns declined status", async () => {
    mockSession(PLAYER_B);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue(makePendingRequest());

    const result = await respondToRematchAction(MATCH_ID, false);

    expect(result).toEqual({ status: "declined" });
    expect(updateRematchRequestStatus).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      "declined",
    );
    expect(writeMatchLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "match.rematch.declined" }),
    );
    expect(broadcastRematchEvent).toHaveBeenCalledWith(
      MATCH_ID,
      expect.objectContaining({ type: "rematch-declined" }),
    );
  });

  it("returns expired when request is stale (>30s)", async () => {
    mockSession(PLAYER_B);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    const staleTime = new Date(Date.now() - 31_000).toISOString();
    vi.mocked(fetchRematchRequest).mockResolvedValue(
      makePendingRequest(staleTime),
    );

    const result = await respondToRematchAction(MATCH_ID, true);

    expect(result).toEqual({ status: "expired" });
    expect(updateRematchRequestStatus).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      "expired",
    );
  });

  it("throws when caller is not the responder", async () => {
    mockSession(PLAYER_A); // requester, not responder
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue(makePendingRequest());

    await expect(respondToRematchAction(MATCH_ID, true)).rejects.toThrow(
      "You are not the responder",
    );
  });

  it("throws when request is already processed", async () => {
    mockSession(PLAYER_B);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue({
      ...makePendingRequest(),
      status: "accepted",
    });

    await expect(respondToRematchAction(MATCH_ID, true)).rejects.toThrow(
      "already been processed",
    );
  });

  it("throws when no rematch request exists", async () => {
    mockSession(PLAYER_B);
    const supabase = makeSupabaseMock();
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue(null);

    await expect(respondToRematchAction(MATCH_ID, true)).rejects.toThrow(
      "No rematch request found",
    );
  });

  it("throws when session is missing", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    await expect(respondToRematchAction(MATCH_ID, true)).rejects.toThrow(
      "Authentication required.",
    );
  });
});
