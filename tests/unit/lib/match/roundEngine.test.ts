import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
    getServiceRoleClient: vi.fn(),
}));

vi.mock("@/app/actions/match/publishRoundSummary", () => ({
    publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
}));

type SubmissionRow = {
    id: string;
    player_id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    submitted_at: string;
};

type MatchRow = {
    id: string;
    current_round: number;
    state: "pending" | "in_progress" | "completed" | "abandoned";
    player_a_id: string;
    player_b_id: string;
    board_seed: string;
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
    };

    const roundRow = {
        id: "round-1",
        state: "collecting" as const,
        board_snapshot_before: createBoard(),
    };

    let updateCalls: any[];
    let roundsInsert: ReturnType<typeof vi.fn>;

    function setupSupabase(submissions: SubmissionRow[], overrides?: Partial<MatchRow>) {
        updateCalls = [];
        const matchChain = createSelectChain({ ...baseMatchRow, ...overrides });
        const roundChain = createRoundSelectChain(roundRow);
        const submissionsChain = createSubmissionsChain(submissions);

        const moveSubmissionUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const moveSubmissionUpdate = vi.fn((payload) => {
            updateCalls.push({ table: "move_submissions", payload });
            return { eq: moveSubmissionUpdateEq };
        });

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
            },
            {
                id: "sub-b",
                player_id: "player-b",
                from_x: 5,
                from_y: 5,
                to_x: 5,
                to_y: 6,
                submitted_at: "2025-01-01T00:00:01Z",
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
            },
            {
                id: "sub-b",
                player_id: "player-b",
                ...sharedMove,
                submitted_at: "2025-01-01T00:00:02Z",
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

    it("returns waiting when only one submission exists", async () => {
        setupSupabase([
            {
                id: "sub-a",
                player_id: "player-a",
                from_x: 0,
                from_y: 0,
                to_x: 0,
                to_y: 1,
                submitted_at: "2025-01-01T00:00:00Z",
            },
        ]);

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
                },
                {
                    id: "sub-b",
                    player_id: "player-b",
                    from_x: 5,
                    from_y: 5,
                    to_x: 5,
                    to_y: 6,
                    submitted_at: "2025-01-01T00:00:01Z",
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
});
