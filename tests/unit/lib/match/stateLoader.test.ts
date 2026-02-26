import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({ aggregateRoundSummary: vi.fn().mockReturnValue(null) }));
vi.mock("@/scripts/supabase/generateBoard", () => ({
  generateBoard: vi.fn().mockReturnValue(
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
  ),
}));

import { loadMatchState } from "@/lib/match/stateLoader";
import { getServiceRoleClient } from "@/lib/supabase/server";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-timer-test";

function makeMockClient(
    matchData: Record<string, unknown>,
    roundData: Record<string, unknown> | null,
    submissionsData: { player_id: string; submitted_at: string }[] | null = null,
) {
    const matchChain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: matchData, error: null }),
    };
    const roundChain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: roundData, error: null }),
    };
    const scoreboardChain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const submissionsResponse = { data: submissionsData ?? [], error: null };
    const moveSubmissionsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue(submissionsResponse),
    };

    return {
        from: vi.fn((table: string) => {
            if (table === "matches") return { select: vi.fn(() => matchChain), update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })) };
            if (table === "rounds") return {
                select: vi.fn(() => roundChain),
                upsert: vi.fn().mockResolvedValue({}),
            };
            if (table === "move_submissions") return moveSubmissionsChain;
            if (table === "scoreboard_snapshots") return { select: vi.fn(() => scoreboardChain) };
            if (table === "word_score_entries") return { select: vi.fn(() => ({ eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
                update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
            };
        }),
    };
}

describe("stateLoader.loadMatchState", () => {
    beforeEach(() => {
        vi.mocked(getServiceRoleClient).mockReset();
    });

    // T022: stateLoader computes mid-round remaining time from round.started_at
    it("T022: computes mid-round remainingMs from round.started_at and stored timer", async () => {
        // Round started 30 seconds ago; player A has 120000ms stored
        const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 1,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 180_000,
                frozen_tiles: {},
            },
            {
                id: "round-1",
                state: "collecting",
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: thirtySecondsAgo,
            },
        );

        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        const state = await loadMatchState(mockClient as never, MATCH_ID);

        expect(state).not.toBeNull();
        // Player A had 120s, round started 30s ago → remaining ≈ 90000ms
        // Allow a 2-second tolerance for test execution time
        const remainingA = state!.timers.playerA.remainingMs;
        expect(remainingA).toBeGreaterThan(88_000);
        expect(remainingA).toBeLessThanOrEqual(90_000);

        // Player B had 180s, should be ≈ 150000ms
        const remainingB = state!.timers.playerB.remainingMs;
        expect(remainingB).toBeGreaterThan(148_000);
        expect(remainingB).toBeLessThanOrEqual(150_000);
    });

    it("T022: falls back to stored timer when round.started_at is null", async () => {
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 1,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 180_000,
                frozen_tiles: {},
            },
            {
                state: "collecting",
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: null,
            },
        );

        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        const state = await loadMatchState(mockClient as never, MATCH_ID);

        expect(state).not.toBeNull();
        // Falls back to stored values
        expect(state!.timers.playerA.remainingMs).toBe(120_000);
        expect(state!.timers.playerB.remainingMs).toBe(180_000);
    });

    it("sets submitting player timer to paused with remaining at submit, other stays running", async () => {
        const roundStartedAt = new Date(Date.now() - 30_000);
        const playerASubmittedAt = new Date(roundStartedAt.getTime() + 20_000); // 20s after round start
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 1,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 180_000,
                frozen_tiles: {},
            },
            {
                id: "round-1",
                state: "collecting",
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: roundStartedAt.toISOString(),
            },
            [{ player_id: PLAYER_A, submitted_at: playerASubmittedAt.toISOString() }],
        );

        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        const state = await loadMatchState(mockClient as never, MATCH_ID);

        expect(state).not.toBeNull();
        expect(state!.timers.playerA.status).toBe("paused");
        expect(state!.timers.playerA.remainingMs).toBe(100_000); // 120_000 - 20_000
        expect(state!.timers.playerB.status).toBe("running");
        expect(state!.timers.playerB.remainingMs).toBeGreaterThan(148_000);
        expect(state!.timers.playerB.remainingMs).toBeLessThanOrEqual(150_000);
    });
});
