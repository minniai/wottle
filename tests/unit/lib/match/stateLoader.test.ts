import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({ aggregateRoundSummary: vi.fn().mockReturnValue(null) }));
vi.mock("@/scripts/supabase/generateBoard", () => ({
  generateBoard: vi.fn().mockReturnValue(
    Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
  ),
}));
// Mocked so the self-heal background trigger doesn't hit the real engine.
vi.mock("@/lib/match/roundEngine", () => ({
  advanceRound: vi.fn().mockResolvedValue({ status: "waiting", received: 2 }),
}));
vi.mock("@/lib/match/recoverStuckRound", () => ({
  recoverStuckRound: vi.fn().mockResolvedValue(undefined),
}));

import {
  loadMatchState,
  __resetSelfHealTrackerForTests,
} from "@/lib/match/stateLoader";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { advanceRound } from "@/lib/match/roundEngine";
import { recoverStuckRound } from "@/lib/match/recoverStuckRound";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const MATCH_ID = "match-timer-test";

type SubmissionFixture = {
    player_id: string;
    submitted_at: string;
    status?: string;
};

function makeMockClient(
    matchData: Record<string, unknown>,
    roundData: Record<string, unknown> | null,
    submissionsData: SubmissionFixture[] | null = null,
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
        vi.mocked(advanceRound).mockClear();
        vi.mocked(recoverStuckRound).mockClear();
        __resetSelfHealTrackerForTests();
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

    it("T028: returns state=completed when match is completed but current round is still in collecting state (timeout/flagging path)", async () => {
        // When both players are flagged, completeMatchInternal is called directly without
        // advancing the current round — the round stays in "collecting" state.
        // mapState must prioritise the match-level completion over the round state.
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "completed",      // match is done
                current_round: 9,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 0,
                player_b_timer_ms: 0,
                frozen_tiles: {},
            },
            {
                id: "round-9",
                state: "collecting",    // round was never advanced — still collecting
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: new Date(Date.now() - 60_000).toISOString(),
            },
        );

        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        const state = await loadMatchState(mockClient as never, MATCH_ID);

        expect(state).not.toBeNull();
        // The client must see "completed" so it can navigate to the summary page.
        expect(state!.state).toBe("completed");
    });

    it("maps round state 'completed' to 'resolving' when match is still in_progress (between-round window)", async () => {
        // When roundEngine marks a round as "completed" but hasn't yet updated
        // current_round to the next round, the safety poller can load this
        // intermediate state. The client must NOT see state="completed" (which
        // would trigger "Rounds Complete" banner mid-game).
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",   // match still going
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
                state: "completed",     // round finished, next round not yet created
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "B")),
                started_at: new Date(Date.now() - 60_000).toISOString(),
            },
        );

        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        const state = await loadMatchState(mockClient as never, MATCH_ID);

        expect(state).not.toBeNull();
        // Must NOT be "completed" — the match isn't over, just the round
        expect(state!.state).not.toBe("completed");
        expect(state!.state).toBe("resolving");
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

describe("stateLoader self-heal (stuck collecting round)", () => {
    beforeEach(() => {
        vi.mocked(advanceRound).mockClear();
        vi.mocked(recoverStuckRound).mockClear();
        __resetSelfHealTrackerForTests();
    });

    function makeStuckClient() {
        const roundStartedAt = new Date(Date.now() - 5_000);
        return makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 10,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 110_000,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "collecting",
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: roundStartedAt.toISOString(),
            },
            [
                { player_id: PLAYER_A, submitted_at: new Date(roundStartedAt.getTime() + 1_000).toISOString(), status: "pending" },
                { player_id: PLAYER_B, submitted_at: new Date(roundStartedAt.getTime() + 2_000).toISOString(), status: "pending" },
            ],
        );
    }

    it("triggers advanceRound when the collecting round has 2 non-timeout submissions", async () => {
        const mockClient = makeStuckClient();
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);

        // Self-heal is fire-and-forget. Yield to the microtask queue so the
        // async IIFE that wraps `await import(...).advanceRound()` can run.
        await new Promise((r) => setImmediate(r));

        expect(advanceRound).toHaveBeenCalledTimes(1);
        expect(advanceRound).toHaveBeenCalledWith(MATCH_ID);
    });

    it("does NOT trigger advanceRound when only one player has submitted", async () => {
        const roundStartedAt = new Date(Date.now() - 5_000);
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 10,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 110_000,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "collecting",
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: roundStartedAt.toISOString(),
            },
            [
                { player_id: PLAYER_A, submitted_at: roundStartedAt.toISOString(), status: "pending" },
            ],
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(advanceRound).not.toHaveBeenCalled();
    });

    it("does NOT trigger advanceRound when the one real submission is paired with a synthetic timeout", async () => {
        // timeout submissions shouldn't count as a real second submission —
        // the round engine will re-synthesize if needed.
        const roundStartedAt = new Date(Date.now() - 5_000);
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 10,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 110_000,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "collecting",
                board_snapshot_before: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
                board_snapshot_after: null,
                started_at: roundStartedAt.toISOString(),
            },
            [
                { player_id: PLAYER_A, submitted_at: roundStartedAt.toISOString(), status: "pending" },
                { player_id: PLAYER_B, submitted_at: roundStartedAt.toISOString(), status: "timeout" },
            ],
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(advanceRound).not.toHaveBeenCalled();
    });

    it("dedupes concurrent stuck-state polls so advanceRound is called at most once in flight", async () => {
        // Make advanceRound slow so the dedup window stays open across both calls.
        let resolveAdvance: () => void = () => {};
        vi.mocked(advanceRound).mockImplementationOnce(
            () => new Promise((r) => { resolveAdvance = () => r({ status: "advanced", nextRound: 11, isGameOver: true, acceptedMoves: 0, rejectedMoves: 0 } as never); }),
        );

        const mockClient = makeStuckClient();
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await Promise.all([
            loadMatchState(mockClient as never, MATCH_ID),
            loadMatchState(mockClient as never, MATCH_ID),
            loadMatchState(mockClient as never, MATCH_ID),
        ]);
        await new Promise((r) => setImmediate(r));

        expect(advanceRound).toHaveBeenCalledTimes(1);
        resolveAdvance();
    });
});

describe("stateLoader self-heal (stuck resolving / post-round / missing winner)", () => {
    beforeEach(() => {
        vi.mocked(advanceRound).mockClear();
        vi.mocked(recoverStuckRound).mockClear();
        __resetSelfHealTrackerForTests();
    });

    const BOARD = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));

    it("does NOT trigger recovery when round has been in 'resolving' for less than the staleness threshold", async () => {
        // resolution_started_at 3s ago — advanceRound's happy path is <1s but 10s
        // grace window means this isn't stuck yet.
        const roundStartedAt = new Date(Date.now() - 5_000);
        const resolutionStartedAt = new Date(Date.now() - 3_000);
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 10,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 110_000,
                winner_id: null,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "resolving",
                board_snapshot_before: BOARD,
                board_snapshot_after: null,
                started_at: roundStartedAt.toISOString(),
                resolution_started_at: resolutionStartedAt.toISOString(),
            },
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(recoverStuckRound).not.toHaveBeenCalled();
        expect(advanceRound).not.toHaveBeenCalled();
    });

    it("triggers recovery when round has been in 'resolving' longer than the staleness threshold", async () => {
        const roundStartedAt = new Date(Date.now() - 20_000);
        const resolutionStartedAt = new Date(Date.now() - 15_000);
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 10,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 110_000,
                winner_id: null,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "resolving",
                board_snapshot_before: BOARD,
                board_snapshot_after: null,
                started_at: roundStartedAt.toISOString(),
                resolution_started_at: resolutionStartedAt.toISOString(),
            },
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(recoverStuckRound).toHaveBeenCalledTimes(1);
        expect(recoverStuckRound).toHaveBeenCalledWith(MATCH_ID);
    });

    it("triggers recovery when round.state='completed' but match.state='in_progress' (post-round stall)", async () => {
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "in_progress",
                current_round: 10,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 120_000,
                player_b_timer_ms: 110_000,
                winner_id: null,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "completed",
                board_snapshot_before: BOARD,
                board_snapshot_after: BOARD,
                started_at: new Date(Date.now() - 30_000).toISOString(),
                resolution_started_at: new Date(Date.now() - 25_000).toISOString(),
            },
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(recoverStuckRound).toHaveBeenCalledTimes(1);
        expect(recoverStuckRound).toHaveBeenCalledWith(MATCH_ID);
    });

    it("triggers recovery when match.state='completed' but winner_id is null", async () => {
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "completed",
                current_round: 11,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 0,
                player_b_timer_ms: 0,
                winner_id: null,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "completed",
                board_snapshot_before: BOARD,
                board_snapshot_after: BOARD,
                started_at: new Date(Date.now() - 60_000).toISOString(),
                resolution_started_at: new Date(Date.now() - 55_000).toISOString(),
            },
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(recoverStuckRound).toHaveBeenCalledTimes(1);
        expect(recoverStuckRound).toHaveBeenCalledWith(MATCH_ID);
    });

    it("does NOT trigger recovery when match.state='completed' and winner_id is set", async () => {
        const mockClient = makeMockClient(
            {
                id: MATCH_ID,
                state: "completed",
                current_round: 11,
                board_seed: "seed-1",
                player_a_id: PLAYER_A,
                player_b_id: PLAYER_B,
                player_a_timer_ms: 0,
                player_b_timer_ms: 0,
                winner_id: PLAYER_A,
                frozen_tiles: {},
            },
            {
                id: "round-10",
                state: "completed",
                board_snapshot_before: BOARD,
                board_snapshot_after: BOARD,
                started_at: new Date(Date.now() - 60_000).toISOString(),
                resolution_started_at: new Date(Date.now() - 55_000).toISOString(),
            },
        );
        vi.mocked(getServiceRoleClient).mockReturnValue(mockClient as never);

        await loadMatchState(mockClient as never, MATCH_ID);
        await new Promise((r) => setImmediate(r));

        expect(recoverStuckRound).not.toHaveBeenCalled();
    });
});
