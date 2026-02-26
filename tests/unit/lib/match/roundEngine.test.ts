import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
    getServiceRoleClient: vi.fn(),
}));

vi.mock("@/app/actions/match/publishRoundSummary", () => ({
    publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
    computeWordScoresForRound: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/actions/match/completeMatch", () => ({
    completeMatchInternal: vi.fn().mockResolvedValue({ matchId: "match-1" }),
}));

type SubmissionRow = {
    id: string;
    player_id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    submitted_at: string;
    status?: string;
};

type MatchRow = {
    id: string;
    current_round: number;
    state: "pending" | "in_progress" | "completed" | "abandoned";
    player_a_id: string;
    player_b_id: string;
    board_seed: string;
    player_a_timer_ms?: number;
    player_b_timer_ms?: number;
    frozen_tiles?: Record<string, unknown>;
};

type RoundRow = {
    id: string;
    state: "collecting" | "resolving" | "completed";
    board_snapshot_before: string[][];
    started_at: string;
};

function createBoard() {
    return Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => "A"),
    );
}

function createSelectChain<T>(data: T) {
    const chain = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    };
    return chain;
}

function createRoundSelectChain<T>(data: T) {
    return {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    };
}

function createSubmissionsChain(data: SubmissionRow[]) {
    const chain: any = { eqCalls: 0 };
    chain.eq = vi.fn(function () {
        chain.eqCalls += 1;
        if (chain.eqCalls >= 2) {
            return Promise.resolve({ data, error: null });
        }
        return chain;
    });
    return chain;
}

describe("roundEngine.advanceRound", () => {
    const baseMatchRow: MatchRow = {
        id: "match-1",
        current_round: 1,
        state: "in_progress",
        player_a_id: "player-a",
        player_b_id: "player-b",
        board_seed: "seed-1",
        player_a_timer_ms: 300_000,
        player_b_timer_ms: 300_000,
        frozen_tiles: {},
    };

    // Use current time by default so clocks are NOT expired in normal tests
    function makeRoundRow(startedAt?: string): RoundRow {
        return {
            id: "round-1",
            state: "collecting",
            board_snapshot_before: createBoard(),
            started_at: startedAt ?? new Date().toISOString(),
        };
    }

    let updateCalls: any[];
    let roundsInsert: ReturnType<typeof vi.fn>;
    let moveSubmissionsInsert: ReturnType<typeof vi.fn>;

    function setupSupabase(
        submissions: SubmissionRow[],
        overrides?: Partial<MatchRow>,
        roundOverride?: Partial<RoundRow>,
    ) {
        updateCalls = [];
        const matchChain = createSelectChain({ ...baseMatchRow, ...overrides });
        const roundData = { ...makeRoundRow(), ...roundOverride };
        const roundChain = createRoundSelectChain(roundData);
        const submissionsChain = createSubmissionsChain(submissions);

        const moveSubmissionUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const moveSubmissionUpdate = vi.fn((payload) => {
            updateCalls.push({ table: "move_submissions", payload });
            return { eq: moveSubmissionUpdateEq };
        });

        moveSubmissionsInsert = vi.fn().mockResolvedValue({ error: null });

        const roundsUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const roundsUpdate = vi.fn((payload) => {
            updateCalls.push({ table: "rounds", payload });
            return { eq: roundsUpdateEq };
        });

        roundsInsert = vi.fn().mockResolvedValue({ error: null });

        const matchesUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const matchesUpdate = vi.fn((payload) => {
            updateCalls.push({ table: "matches", payload });
            return { eq: matchesUpdateEq };
        });

        const scoreboardChain = createSelectChain({
            player_a_score: 0,
            player_b_score: 0,
        });

        const channelMock = {
            send: vi.fn().mockResolvedValue("ok"),
            unsubscribe: vi.fn(),
        };

        const supabaseMock = {
            from: vi.fn((table: string) => {
                if (table === "matches") {
                    return {
                        select: vi.fn(() => matchChain),
                        update: matchesUpdate,
                    };
                }

                if (table === "rounds") {
                    return {
                        select: vi.fn(() => roundChain),
                        update: roundsUpdate,
                        insert: roundsInsert,
                    };
                }

                if (table === "scoreboard_snapshots") {
                    return {
                        select: vi.fn(() => scoreboardChain),
                    };
                }

                if (table === "move_submissions") {
                    return {
                        select: vi.fn(() => submissionsChain),
                        update: moveSubmissionUpdate,
                        insert: moveSubmissionsInsert,
                    };
                }

                return {};
            }),
            channel: vi.fn(() => channelMock),
        };

        vi.mocked(getServiceRoleClient).mockReturnValue(supabaseMock as never);
    }

    beforeEach(() => {
        vi.mocked(getServiceRoleClient).mockReset();
    });

    it("advances to the next round when submissions from both players exist", async () => {
        setupSupabase([
            {
                id: "sub-a",
                player_id: "player-a",
                from_x: 0,
                from_y: 0,
                to_x: 0,
                to_y: 1,
                submitted_at: "2025-01-01T00:00:00Z",
                status: "pending",
            },
            {
                id: "sub-b",
                player_id: "player-b",
                from_x: 5,
                from_y: 5,
                to_x: 5,
                to_y: 6,
                submitted_at: "2025-01-01T00:00:01Z",
                status: "pending",
            },
        ]);

        const result = await advanceRound("match-1");

        expect(result).toEqual(
            expect.objectContaining({
                status: "advanced",
                nextRound: 2,
                isGameOver: false,
                acceptedMoves: 2,
                rejectedMoves: 0,
            }),
        );

        const moveStatusUpdates = updateCalls.filter((c) => c.table === "move_submissions");
        expect(moveStatusUpdates).toHaveLength(2);
        expect(moveStatusUpdates[0].payload.status).toBe("accepted");
        expect(moveStatusUpdates[1].payload.status).toBe("accepted");

        expect(roundsInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                round_number: 2,
                state: "collecting",
            }),
        );
    });

    it("marks conflicting submissions as rejected_invalid", async () => {
        const sharedMove = {
            from_x: 0,
            from_y: 0,
            to_x: 0,
            to_y: 1,
        };

        setupSupabase([
            {
                id: "sub-a",
                player_id: "player-a",
                ...sharedMove,
                submitted_at: "2025-01-01T00:00:00Z",
                status: "pending",
            },
            {
                id: "sub-b",
                player_id: "player-b",
                ...sharedMove,
                submitted_at: "2025-01-01T00:00:02Z",
                status: "pending",
            },
        ]);

        const result = await advanceRound("match-1");

        expect(result.rejectedMoves).toBe(1);
        const moveStatusUpdates = updateCalls.filter((c) => c.table === "move_submissions");
        expect(moveStatusUpdates).toHaveLength(2);
        const rejectedPayload = moveStatusUpdates.find(
            (call) => call.payload.status === "rejected_invalid",
        );
        expect(rejectedPayload).toBeDefined();
    });

    it("returns waiting when only one submission exists and clock not expired", async () => {
        // Use a fresh start time so clock is not expired for the absent player
        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: "2025-01-01T00:00:00Z",
                    status: "pending",
                },
            ],
            undefined,
            { started_at: new Date().toISOString() }, // clock just started
        );

        const result = await advanceRound("match-1");

        expect(result).toEqual({ status: "waiting", received: 1 });
    });

    it("does not advance when match is not in progress", async () => {
        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: "2025-01-01T00:00:00Z",
                    status: "pending",
                },
                {
                    id: "sub-b",
                    player_id: "player-b",
                    from_x: 5,
                    from_y: 5,
                    to_x: 5,
                    to_y: 6,
                    submitted_at: "2025-01-01T00:00:01Z",
                    status: "pending",
                },
            ],
            { state: "completed" as const },
        );

        const result = await advanceRound("match-1");

        expect(result).toEqual({
            status: "not_advancing",
            reason: "Match is not in progress",
        });
    });

    // T005: advanceRound transitions match state to "completed" after round 10
    it("T005: transitions match state to completed and calls completeMatchInternal when nextRound > 10", async () => {
        const { completeMatchInternal } = await import("@/app/actions/match/completeMatch");
        vi.mocked(completeMatchInternal).mockClear();

        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: "2026-01-01T00:00:00Z",
                    status: "pending",
                },
                {
                    id: "sub-b",
                    player_id: "player-b",
                    from_x: 5,
                    from_y: 5,
                    to_x: 5,
                    to_y: 6,
                    submitted_at: "2026-01-01T00:00:01Z",
                    status: "pending",
                },
            ],
            { current_round: 10 },
        );

        const result = await advanceRound("match-1");

        expect(result).toEqual(
            expect.objectContaining({
                status: "advanced",
                nextRound: 11,
                isGameOver: true,
            }),
        );

        // The match update should include state: "completed"
        const matchUpdate = updateCalls.find(
            (c) => c.table === "matches" && c.payload.state === "completed",
        );
        expect(matchUpdate).toBeDefined();

        // completeMatchInternal should be called with "round_limit"
        expect(completeMatchInternal).toHaveBeenCalledWith("match-1", "round_limit");

        // No new round should be inserted after game over
        expect(roundsInsert).not.toHaveBeenCalled();
    });

    // T013: createNextRound sets started_at
    it("T013: creates next round with started_at set to current server timestamp", async () => {
        setupSupabase([
            {
                id: "sub-a",
                player_id: "player-a",
                from_x: 0,
                from_y: 0,
                to_x: 0,
                to_y: 1,
                submitted_at: "2026-01-01T00:00:00Z",
                status: "pending",
            },
            {
                id: "sub-b",
                player_id: "player-b",
                from_x: 5,
                from_y: 5,
                to_x: 5,
                to_y: 6,
                submitted_at: "2026-01-01T00:00:01Z",
                status: "pending",
            },
        ]);

        await advanceRound("match-1");

        expect(roundsInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                round_number: 2,
                state: "collecting",
                started_at: expect.any(String),
            }),
        );
    });

    // T007b: deductTimerMs clamps to 0 when elapsed > remaining
    it("T007b: clamps deducted timer to 0 when elapsed exceeds remaining time", async () => {
        // player-a has 10s, round started 30s ago, submitted at start of round
        const roundStart = new Date("2026-02-25T10:00:00Z");
        const playerASubmittedAt = new Date("2026-02-25T10:00:30Z"); // 30s elapsed, but only 10s remaining

        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: playerASubmittedAt.toISOString(),
                    status: "pending",
                },
                {
                    id: "sub-b",
                    player_id: "player-b",
                    from_x: 5,
                    from_y: 5,
                    to_x: 5,
                    to_y: 6,
                    submitted_at: new Date("2026-02-25T10:00:05Z").toISOString(),
                    status: "pending",
                },
            ],
            { player_a_timer_ms: 10_000, player_b_timer_ms: 300_000 }, // player-a only had 10s
            { started_at: roundStart.toISOString() },
        );

        await advanceRound("match-1");

        const matchUpdates = updateCalls.filter((c) => c.table === "matches");
        const timerUpdate = matchUpdates.find(
            (c) => c.payload.player_a_timer_ms !== undefined,
        );
        expect(timerUpdate).toBeDefined();
        // 10s remaining - 30s elapsed = clamped to 0
        expect(timerUpdate.payload.player_a_timer_ms).toBe(0);
    });

    // T007c: timer unchanged when round has no started_at
    it("T007c: does not deduct timer when round has no started_at", async () => {
        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: new Date().toISOString(),
                    status: "pending",
                },
                {
                    id: "sub-b",
                    player_id: "player-b",
                    from_x: 5,
                    from_y: 5,
                    to_x: 5,
                    to_y: 6,
                    submitted_at: new Date().toISOString(),
                    status: "pending",
                },
            ],
            { player_a_timer_ms: 180_000, player_b_timer_ms: 240_000 },
            { started_at: "" }, // no started_at → no deduction
        );

        await advanceRound("match-1");

        const matchUpdates = updateCalls.filter((c) => c.table === "matches");
        const timerUpdate = matchUpdates.find(
            (c) => c.payload.player_a_timer_ms !== undefined,
        );
        // Timer should remain at original value when no started_at
        expect(timerUpdate?.payload.player_a_timer_ms).toBe(180_000);
        expect(timerUpdate?.payload.player_b_timer_ms).toBe(240_000);
    });

    // T017: timeout-pass synthesis when absent player's clock expired
    it("T017: inserts synthetic timeout submission when 1 submission exists and absent player's clock is expired", async () => {
        // Round started 10 minutes ago, player-b timer was only 60 seconds → expired
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: new Date().toISOString(),
                    status: "pending",
                },
            ],
            { player_b_timer_ms: 60_000 }, // player-b only had 60s, expired
            { started_at: tenMinutesAgo },
        );

        const result = await advanceRound("match-1");

        // Should have inserted a synthetic timeout submission for player-b
        expect(moveSubmissionsInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                player_id: "player-b",
                status: "timeout",
            }),
        );

        // Round should advance (not return "waiting")
        expect(result).toEqual(
            expect.objectContaining({
                status: "advanced",
            }),
        );
    });

    // T009a: no synthesis when both players have submitted
    it("T009a: does not insert a synthetic timeout submission when both players have submitted", async () => {
        setupSupabase([
            {
                id: "sub-a",
                player_id: "player-a",
                from_x: 0,
                from_y: 0,
                to_x: 0,
                to_y: 1,
                submitted_at: new Date().toISOString(),
                status: "pending",
            },
            {
                id: "sub-b",
                player_id: "player-b",
                from_x: 5,
                from_y: 5,
                to_x: 5,
                to_y: 6,
                submitted_at: new Date().toISOString(),
                status: "pending",
            },
        ]);

        await advanceRound("match-1");

        // No synthetic timeout submission should be inserted
        expect(moveSubmissionsInsert).not.toHaveBeenCalledWith(
            expect.objectContaining({ status: "timeout" }),
        );
    });

    // T020: timer deduction after round resolves
    it("T020: deducts elapsed time from player timers after round resolves", async () => {
        const roundStart = new Date("2026-02-25T10:00:00Z");
        const playerASubmittedAt = new Date("2026-02-25T10:00:30Z"); // 30s after start
        const playerBSubmittedAt = new Date("2026-02-25T10:00:45Z"); // 45s after start

        setupSupabase(
            [
                {
                    id: "sub-a",
                    player_id: "player-a",
                    from_x: 0,
                    from_y: 0,
                    to_x: 0,
                    to_y: 1,
                    submitted_at: playerASubmittedAt.toISOString(),
                    status: "pending",
                },
                {
                    id: "sub-b",
                    player_id: "player-b",
                    from_x: 5,
                    from_y: 5,
                    to_x: 5,
                    to_y: 6,
                    submitted_at: playerBSubmittedAt.toISOString(),
                    status: "pending",
                },
            ],
            { player_a_timer_ms: 300_000, player_b_timer_ms: 300_000 },
            { started_at: roundStart.toISOString() },
        );

        await advanceRound("match-1");

        // Match update should contain deducted timer values
        const matchUpdates = updateCalls.filter((c) => c.table === "matches");
        const timerUpdate = matchUpdates.find(
            (c) => c.payload.player_a_timer_ms !== undefined || c.payload.player_b_timer_ms !== undefined,
        );

        expect(timerUpdate).toBeDefined();
        // player-a took 30s → 300000 - 30000 = 270000
        expect(timerUpdate.payload.player_a_timer_ms).toBe(270_000);
        // player-b took 45s → 300000 - 45000 = 255000
        expect(timerUpdate.payload.player_b_timer_ms).toBe(255_000);
    });
});
