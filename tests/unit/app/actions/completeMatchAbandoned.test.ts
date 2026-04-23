import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/statePublisher", () => ({
  publishMatchState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/match/logWriter", () => ({
  writeMatchLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/observability/log", () => ({
  trackMatchResult: vi.fn(),
}));
vi.mock("@/lib/rating/persistRatingChanges", () => ({
  persistRatingChanges: vi.fn().mockResolvedValue(undefined),
}));

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { persistRatingChanges } from "@/lib/rating/persistRatingChanges";
import { getServiceRoleClient } from "@/lib/supabase/server";

const MATCH_ID = "00000000-0000-0000-0000-000000000099";
const PLAYER_A = "player-a-id";
const PLAYER_B = "player-b-id";

interface MockState {
  match: {
    id: string;
    state: string;
    player_a_id: string;
    player_b_id: string;
    winner_id: string | null;
    ended_reason: string | null;
    round_limit: number;
    frozen_tiles: Record<string, unknown> | null;
  };
  matchUpdatePayloads: Record<string, unknown>[];
}

function buildSupabase(state: MockState) {
  const matchesUpdateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const matchesUpdate = vi.fn((payload: Record<string, unknown>) => {
    state.matchUpdatePayloads.push(payload);
    return matchesUpdateChain;
  });

  const matchesSelectSingle = vi
    .fn()
    .mockResolvedValue({ data: state.match, error: null });
  const matchesSelectEq = vi.fn(() => ({ single: matchesSelectSingle }));
  const matchesSelect = vi.fn(() => ({ eq: matchesSelectEq }));

  const scoreboardMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: null, error: null });
  const scoreboardLimit = vi.fn(() => ({ maybeSingle: scoreboardMaybeSingle }));
  const scoreboardOrder = vi.fn(() => ({ limit: scoreboardLimit }));
  const scoreboardEq = vi.fn(() => ({ order: scoreboardOrder }));
  const scoreboardSelect = vi.fn(() => ({ eq: scoreboardEq }));

  const playersUpdateChain = {
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  const playersUpdate = vi.fn(() => playersUpdateChain);

  const presenceUpdateChain = {
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  const presenceUpdate = vi.fn(() => presenceUpdateChain);

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return { select: matchesSelect, update: matchesUpdate };
      }
      if (table === "scoreboard_snapshots") {
        return { select: scoreboardSelect };
      }
      if (table === "players") {
        return { update: playersUpdate };
      }
      if (table === "lobby_presence") {
        return { update: presenceUpdate };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function freshState(): MockState {
  return {
    match: {
      id: MATCH_ID,
      state: "in_progress",
      player_a_id: PLAYER_A,
      player_b_id: PLAYER_B,
      winner_id: null,
      ended_reason: null,
      round_limit: 10,
      frozen_tiles: {},
    },
    matchUpdatePayloads: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("completeMatchInternal — abandoned reason", () => {
  test("finalises a fresh in_progress match with winner_id=null", async () => {
    const state = freshState();
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    const result = await completeMatchInternal(MATCH_ID, "abandoned");

    expect(result.matchId).toBe(MATCH_ID);
    expect(result.winnerId).toBeNull();
    expect(result.loserId).toBeNull();
    expect(result.endedReason).toBe("abandoned");
    expect(state.matchUpdatePayloads).toHaveLength(1);
    expect(state.matchUpdatePayloads[0]).toMatchObject({
      state: "completed",
      winner_id: null,
      ended_reason: "abandoned",
    });
  });

  test("does not write match_ratings for abandoned matches", async () => {
    const state = freshState();
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    await completeMatchInternal(MATCH_ID, "abandoned");

    expect(persistRatingChanges).not.toHaveBeenCalled();
  });

  test("short-circuits when match already completed with no winner", async () => {
    const state = freshState();
    state.match.state = "completed";
    state.match.winner_id = null;
    state.match.ended_reason = "abandoned";
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    const result = await completeMatchInternal(MATCH_ID, "abandoned");

    expect(result.winnerId).toBeNull();
    expect(result.endedReason).toBe("abandoned");
    expect(state.matchUpdatePayloads).toHaveLength(0);
    expect(persistRatingChanges).not.toHaveBeenCalled();
  });

  test("still short-circuits when match already completed with a winner", async () => {
    const state = freshState();
    state.match.state = "completed";
    state.match.winner_id = PLAYER_A;
    state.match.ended_reason = "round_limit";
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    const result = await completeMatchInternal(MATCH_ID, "abandoned");

    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.endedReason).toBe("round_limit");
    expect(state.matchUpdatePayloads).toHaveLength(0);
  });
});
