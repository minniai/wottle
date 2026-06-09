import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
    getServiceRoleClient: vi.fn(),
}));

vi.mock("@/app/actions/match/publishRoundSummary", () => ({
    publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
    computeWordScoresForRound: vi.fn().mockResolvedValue({
        wordScores: [],
        finalBoard: Array.from({ length: 10 }, () =>
            Array.from({ length: 10 }, () => "A"),
        ),
        newFrozenTiles: {},
    }),
}));

vi.mock("@/app/actions/match/completeMatch", () => ({
    completeMatchInternal: vi.fn().mockResolvedValue({ matchId: "match-1" }),
}));

vi.mock("@/lib/match/statePublisher", () => ({
    publishMatchState: vi.fn().mockResolvedValue(undefined),
}));

import { computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";

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

function createBoard() {
    return Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => "A"),
    );
}

function createSelectChain<T>(data: T) {
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

const BOTH_SUBMISSIONS: SubmissionRow[] = [
    {
        id: "sub-a",
        player_id: "player-a",
        from_x: 0,
        from_y: 0,
        to_x: 1,
        to_y: 0,
        submitted_at: "2026-06-09T00:00:00Z",
        status: "pending",
    },
    {
        id: "sub-b",
        player_id: "player-b",
        from_x: 5,
        from_y: 5,
        to_x: 5,
        to_y: 6,
        submitted_at: "2026-06-09T00:00:01Z",
        status: "pending",
    },
];

// Spec 042 regression — the instant-scoring fast path merges the first
// mover's freezes into matches.frozen_tiles while the round is still
// `collecting`. The combined pass MUST NOT feed those same-round freezes
// back into processRoundScoring as the scoring baseline: doing so makes the
// frozen-coordinate guard reject the first mover's own swap, wiping their
// word_score_entries rows (delete-then-insert) and dropping the swap from
// the final board. The canonical baseline is rounds.frozen_tiles_before.
describe("roundEngine.advanceRound — frozen-tile scoring baseline (spec 042)", () => {
    // matches.frozen_tiles as polluted by the fast path mid-round: the first
    // mover's swap tiles are already frozen.
    const FAST_PATH_POLLUTED = {
        "0,0": { owner: "player_a" },
        "1,0": { owner: "player_a" },
    };
    // The freeze state when the round started collecting (a tile frozen in a
    // PRIOR round, so we can also assert prior freezes are preserved).
    const ROUND_START_BASELINE = {
        "9,9": { owner: "player_b" },
    };

    let roundsInsert: ReturnType<typeof vi.fn>;

    function setupSupabase(roundFrozenTilesBefore: Record<string, unknown> | null) {
        const matchChain = createSelectChain({
            id: "match-1",
            current_round: 2,
            state: "in_progress",
            player_a_id: "player-a",
            player_b_id: "player-b",
            board_seed: "seed-1",
            player_a_timer_ms: 300_000,
            player_b_timer_ms: 300_000,
            frozen_tiles: FAST_PATH_POLLUTED,
        });
        const roundChain = createSelectChain({
            id: "round-2",
            state: "collecting",
            board_snapshot_before: createBoard(),
            started_at: new Date().toISOString(),
            frozen_tiles_before: roundFrozenTilesBefore,
        });
        const submissionsChain = createSubmissionsChain(BOTH_SUBMISSIONS);

        const makeRoundsUpdateChain = () => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn().mockImplementation(() => chain);
            chain.select = vi
                .fn()
                .mockResolvedValue({ data: [{ id: "round-2" }], error: null });
            (chain as { then: unknown }).then = (
                onFulfilled: (v: { error: null }) => unknown,
            ) => Promise.resolve({ error: null }).then(onFulfilled);
            return chain;
        };

        roundsInsert = vi.fn().mockResolvedValue({ error: null });

        const supabaseMock = {
            from: vi.fn((table: string) => {
                if (table === "matches") {
                    return {
                        select: vi.fn(() => matchChain),
                        update: vi.fn(() => ({
                            eq: vi.fn().mockResolvedValue({ error: null }),
                        })),
                    };
                }
                if (table === "rounds") {
                    return {
                        select: vi.fn(() => roundChain),
                        update: vi.fn(() => makeRoundsUpdateChain()),
                        insert: roundsInsert,
                    };
                }
                if (table === "move_submissions") {
                    return {
                        select: vi.fn(() => submissionsChain),
                        update: vi.fn(() => ({
                            eq: vi.fn().mockResolvedValue({ error: null }),
                        })),
                        insert: vi.fn().mockResolvedValue({ error: null }),
                    };
                }
                if (table === "scoreboard_snapshots") {
                    return {
                        select: vi.fn(() =>
                            createSelectChain({ player_a_score: 0, player_b_score: 0 }),
                        ),
                    };
                }
                return {};
            }),
            channel: vi.fn(() => ({
                send: vi.fn().mockResolvedValue("ok"),
                unsubscribe: vi.fn(),
            })),
        };

        vi.mocked(getServiceRoleClient).mockReturnValue(supabaseMock as never);
    }

    beforeEach(() => {
        vi.mocked(getServiceRoleClient).mockReset();
        vi.mocked(computeWordScoresForRound).mockClear();
    });

    it("scores against rounds.frozen_tiles_before, NOT the fast-path-polluted matches.frozen_tiles", async () => {
        setupSupabase(ROUND_START_BASELINE);

        await advanceRound("match-1");

        expect(computeWordScoresForRound).toHaveBeenCalledOnce();
        const frozenTilesArg =
            vi.mocked(computeWordScoresForRound).mock.calls[0][7];
        expect(frozenTilesArg).toEqual(ROUND_START_BASELINE);
        expect(frozenTilesArg).not.toEqual(FAST_PATH_POLLUTED);
    });

    it("falls back to matches.frozen_tiles when frozen_tiles_before is null (legacy rounds)", async () => {
        setupSupabase(null);

        await advanceRound("match-1");

        const frozenTilesArg =
            vi.mocked(computeWordScoresForRound).mock.calls[0][7];
        expect(frozenTilesArg).toEqual(FAST_PATH_POLLUTED);
    });

    it("seeds the next round's frozen_tiles_before with the scoring result's newFrozenTiles", async () => {
        const canonicalAfterRound = {
            ...ROUND_START_BASELINE,
            "0,0": { owner: "player_a" },
            "1,0": { owner: "player_a" },
        };
        vi.mocked(computeWordScoresForRound).mockResolvedValueOnce({
            wordScores: [],
            finalBoard: createBoard(),
            newFrozenTiles: canonicalAfterRound,
        } as never);

        setupSupabase(ROUND_START_BASELINE);

        await advanceRound("match-1");

        expect(roundsInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                round_number: 3,
                frozen_tiles_before: canonicalAfterRound,
            }),
        );
    });
});
