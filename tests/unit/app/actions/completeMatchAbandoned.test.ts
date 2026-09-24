import { beforeEach, describe, expect, test, vi } from "vitest";

// Spec 060: ratings are read per language from player_ratings; this test's database stub has none.
vi.mock("@/lib/rating/playerRatings", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/rating/playerRatings");
  return {
    ...actual,
    readRatings: vi.fn(async (_c: unknown, ids: string[]) => new Map(ids.map((id) => [id, { ...actual.DEFAULT_RATING_RECORD }]))),
    readEloRatings: vi.fn(async (_c: unknown, ids: string[]) => new Map(ids.map((id) => [id, 1200]))),
  };
});
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/unseenResult", () => ({ markUnseenResult: vi.fn(async () => undefined) }));
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
    move_limit: number;
    frozen_tiles: Record<string, unknown> | null;
    player_a_score: number;
    player_b_score: number;
    player_a_moves: number;
    player_b_moves: number;
  };
  matchUpdatePayloads: Record<string, unknown>[];
  /** Rows the completion compare-and-set reports as flipped (spec 050 FR-011). */
  flippedRows: number;
}

function buildSupabase(state: MockState) {
  const matchesUpdate = vi.fn((payload: Record<string, unknown>) => {
    state.matchUpdatePayloads.push(payload);
    const chain: { eq: () => typeof chain; in: () => typeof chain; select: () => Promise<{ data: { id: string }[]; error: null }> } = {
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      select: vi.fn().mockResolvedValue({
        data: Array.from({ length: state.flippedRows }, () => ({ id: state.match.id })),
        error: null,
      }),
    };
    return chain;
  });

  const matchesSelectSingle = vi
    .fn()
    .mockResolvedValue({ data: state.match, error: null });
  const matchesSelectEq = vi.fn(() => ({ single: matchesSelectSingle }));
  const matchesSelect = vi.fn(() => ({ eq: matchesSelectEq }));

  const playersUpdateChain = {
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  const playersUpdate = vi.fn(() => playersUpdateChain);
  const playersSelect = vi.fn(() => ({
    in: vi.fn().mockResolvedValue({
      data: [
        { id: PLAYER_A, elo_rating: 1200, games_played: 0 },
        { id: PLAYER_B, elo_rating: 1200, games_played: 0 },
      ],
      error: null,
    }),
  }));

  const presenceUpdateChain = {
    in: vi.fn().mockResolvedValue({ error: null }),
  };
  const presenceUpdate = vi.fn(() => presenceUpdateChain);

  return {
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return { select: matchesSelect, update: matchesUpdate };
      }
      if (table === "players") {
        return { update: playersUpdate, select: playersSelect };
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
      move_limit: 10,
      frozen_tiles: {},
      player_a_score: 0,
      player_b_score: 0,
      player_a_moves: 0,
      player_b_moves: 0,
    },
    matchUpdatePayloads: [],
    flippedRows: 1,
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
    state.match.ended_reason = "moves_complete";
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    const result = await completeMatchInternal(MATCH_ID, "abandoned");

    expect(result.winnerId).toBe(PLAYER_A);
    expect(result.endedReason).toBe("moves_complete");
    expect(state.matchUpdatePayloads).toHaveLength(0);
  });
});

describe("completeMatchInternal — the completion compare-and-set (spec 050 FR-011)", () => {
  test("a natural end penalises the short player's unplayed moves, then the score decides (`incomplete`, rules §5.6)", async () => {
    const state = freshState();
    state.match.player_a_moves = 10;
    state.match.player_b_moves = 8;
    state.match.player_a_score = 88;
    state.match.player_b_score = 134;
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    const result = await completeMatchInternal(MATCH_ID, "natural");

    // B's two unplayed moves: −5 each → 134 − 10 = 124, still ahead of 88.
    expect(result.winnerId).toBe(PLAYER_B);
    expect(result.endedReason).toBe("incomplete");
    expect(result.scores).toEqual({ playerA: 88, playerB: 124 });
    expect(state.matchUpdatePayloads[0]).toMatchObject({ state: "completed", winner_id: PLAYER_B, ended_reason: "incomplete", player_b_score: 124 });
    expect(persistRatingChanges).toHaveBeenCalledTimes(1);
  });

  test("when another trigger flipped the row first, nothing is rated and the written result is returned", async () => {
    const state = freshState();
    state.match.player_a_moves = 10;
    state.match.player_b_moves = 10;
    state.flippedRows = 0;
    vi.mocked(getServiceRoleClient).mockReturnValue(buildSupabase(state) as never);

    const result = await completeMatchInternal(MATCH_ID, "natural");

    expect(persistRatingChanges).not.toHaveBeenCalled();
    expect(result.matchId).toBe(MATCH_ID);
  });
});
