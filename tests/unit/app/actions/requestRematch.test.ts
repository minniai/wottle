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
  insertRematchRequest: vi.fn(),
  updateRematchRequestStatus: vi.fn(),
}));
vi.mock("@/lib/match/rematchService", () => ({
  detectSimultaneousRematch: vi.fn(),
  validateRematchRequest: vi.fn(),
}));
vi.mock("@/lib/matchmaking/service", () => ({
  bootstrapMatchRecord: vi.fn(),
}));

import { requestRematchAction } from "@/app/actions/match/requestRematch";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  fetchRematchRequest,
  insertRematchRequest,
} from "@/lib/match/rematchRepository";
import {
  detectSimultaneousRematch,
  validateRematchRequest,
} from "@/lib/match/rematchService";
import { broadcastRematchEvent } from "@/lib/match/rematchBroadcast";
import { bootstrapMatchRecord } from "@/lib/matchmaking/service";

const PLAYER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PLAYER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MATCH_ID = "11111111-1111-1111-1111-111111111111";

function mockSession(playerId: string) {
  vi.mocked(readLobbySession).mockResolvedValue({
    player: { id: playerId, username: "test", displayName: "Test" },
  } as any);
}

function makeSupabaseMock(matchData: Record<string, unknown> | null) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: matchData, error: null }),
  };
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    })),
  };
}

describe("requestRematchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pending status for a normal request", async () => {
    mockSession(PLAYER_A);
    const supabase = makeSupabaseMock({
      id: MATCH_ID,
      state: "completed",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue(null);
    vi.mocked(validateRematchRequest).mockReturnValue(null);
    vi.mocked(detectSimultaneousRematch).mockReturnValue(false);
    vi.mocked(insertRematchRequest).mockResolvedValue({
      id: "req-1",
      matchId: MATCH_ID,
      requesterId: PLAYER_A,
      responderId: PLAYER_B,
      status: "pending",
      newMatchId: null,
      createdAt: new Date().toISOString(),
      respondedAt: null,
    });

    const result = await requestRematchAction(MATCH_ID);

    expect(result).toEqual({ status: "pending" });
    expect(insertRematchRequest).toHaveBeenCalledWith(
      expect.anything(),
      MATCH_ID,
      PLAYER_A,
      PLAYER_B,
    );
    expect(broadcastRematchEvent).toHaveBeenCalledWith(
      MATCH_ID,
      expect.objectContaining({ type: "rematch-request" }),
    );
  });

  it("returns accepted with matchId on simultaneous detection", async () => {
    mockSession(PLAYER_B);
    const supabase = makeSupabaseMock({
      id: MATCH_ID,
      state: "completed",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    const existingRequest = {
      id: "req-1",
      matchId: MATCH_ID,
      requesterId: PLAYER_A,
      responderId: PLAYER_B,
      status: "pending" as const,
      newMatchId: null,
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };
    vi.mocked(fetchRematchRequest).mockResolvedValue(existingRequest);
    vi.mocked(validateRematchRequest).mockReturnValue(null);
    vi.mocked(detectSimultaneousRematch).mockReturnValue(true);
    vi.mocked(bootstrapMatchRecord).mockResolvedValue("new-match-1");

    const result = await requestRematchAction(MATCH_ID);

    expect(result).toEqual({ status: "accepted", matchId: "new-match-1" });
    expect(bootstrapMatchRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rematchOf: MATCH_ID }),
    );
  });

  it("throws when session is missing", async () => {
    vi.mocked(readLobbySession).mockResolvedValue(null);

    await expect(requestRematchAction(MATCH_ID)).rejects.toThrow(
      "Authentication required.",
    );
  });

  it("throws when validation fails", async () => {
    mockSession(PLAYER_A);
    const supabase = makeSupabaseMock({
      id: MATCH_ID,
      state: "completed",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue(supabase as any);
    vi.mocked(fetchRematchRequest).mockResolvedValue(null);
    vi.mocked(validateRematchRequest).mockReturnValue(
      "Match is not finished yet.",
    );

    await expect(requestRematchAction(MATCH_ID)).rejects.toThrow(
      "Match is not finished yet.",
    );
  });
});
