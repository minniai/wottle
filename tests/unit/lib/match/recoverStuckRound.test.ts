import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/app/actions/match/completeMatch", () => ({
    completeMatchInternal: vi.fn().mockResolvedValue({ matchId: "match-1", winnerId: "player-a" }),
}));
vi.mock("@/app/actions/match/publishRoundSummary", () => ({
    computeWordScoresForRound: vi.fn().mockResolvedValue({
        wordScores: [],
        finalBoard: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
    }),
    publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/match/statePublisher", () => ({
    publishMatchState: vi.fn().mockResolvedValue(undefined),
}));

import { recoverStuckRound } from "@/lib/match/recoverStuckRound";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import {
    computeWordScoresForRound,
    publishRoundSummary,
} from "@/app/actions/match/publishRoundSummary";
import { publishMatchState } from "@/lib/match/statePublisher";

const MATCH_ID = "match-stuck";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";
const ROUND_ID = "round-10";

type MatchRow = {
    id: string;
    state: "in_progress" | "completed" | "abandoned" | "pending";
    current_round: number;
    player_a_id: string;
    player_b_id: string;
    winner_id: string | null;
    board_seed: string;
    frozen_tiles: Record<string, unknown>;
    player_a_timer_ms: number;
    player_b_timer_ms: number;
};

type RoundRow = {
    id: string;
    state: "collecting" | "resolving" | "completed";
    board_snapshot_before: string[][];
    started_at: string | null;
    resolution_started_at: string | null;
};

type SubmissionRow = {
    id: string;
    player_id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    submitted_at: string;
    status: string;
};

interface BuildClientOpts {
    match: MatchRow;
    round?: RoundRow;
    submissions?: SubmissionRow[];
    existingWordEntries?: Array<{ id: string }>;
    /** Scoreboard snapshots already persisted for the round. `null` (default) =
     *  missing → recovery should call publishRoundSummary. */
    existingSnapshot?: { round_number: number } | null;
}

function buildMockClient({
    match,
    round,
    submissions = [],
    existingWordEntries = [],
    existingSnapshot = null,
}: BuildClientOpts) {
    // Track writes for assertions
    const matchUpdates: Array<Record<string, unknown>> = [];
    const roundUpdates: Array<Record<string, unknown>> = [];
    const submissionUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    const from = vi.fn((table: string) => {
        if (table === "matches") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: match, error: null }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: match, error: null }),
                })),
                update: vi.fn((patch: Record<string, unknown>) => {
                    matchUpdates.push(patch);
                    return { eq: vi.fn().mockResolvedValue({ error: null }) };
                }),
            };
        }
        if (table === "rounds") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: round ?? null, error: round ? null : { message: "not found" } }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: round ?? null, error: null }),
                })),
                update: vi.fn((patch: Record<string, unknown>) => {
                    roundUpdates.push(patch);
                    return { eq: vi.fn().mockResolvedValue({ error: null }) };
                }),
            };
        }
        if (table === "move_submissions") {
            const select = vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: submissions, error: null }),
            }));
            const update = vi.fn((patch: Record<string, unknown>) => ({
                eq: vi.fn((col: string, id: string) => {
                    submissionUpdates.push({ id, patch });
                    return Promise.resolve({ error: null });
                }),
            }));
            return { select, update };
        }
        if (table === "word_score_entries") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ data: existingWordEntries, error: null }),
                })),
            };
        }
        if (table === "scoreboard_snapshots") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: existingSnapshot, error: null }),
                })),
            };
        }
        return {
            select: vi.fn(() => ({
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
            insert: vi.fn().mockResolvedValue({}),
        };
    });

    return {
        client: { from } as unknown as ReturnType<typeof getServiceRoleClient>,
        matchUpdates,
        roundUpdates,
        submissionUpdates,
    };
}

const BOARD = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));

function baseMatch(overrides: Partial<MatchRow> = {}): MatchRow {
    return {
        id: MATCH_ID,
        state: "in_progress",
        current_round: 10,
        player_a_id: PLAYER_A,
        player_b_id: PLAYER_B,
        winner_id: null,
        board_seed: "seed-1",
        frozen_tiles: {},
        player_a_timer_ms: 120_000,
        player_b_timer_ms: 110_000,
        ...overrides,
    };
}

function baseRound(overrides: Partial<RoundRow> = {}): RoundRow {
    const startedAt = new Date(Date.now() - 20_000).toISOString();
    return {
        id: ROUND_ID,
        state: "resolving",
        board_snapshot_before: BOARD,
        started_at: startedAt,
        resolution_started_at: new Date(Date.now() - 15_000).toISOString(),
        ...overrides,
    };
}

function baseSubmissions(status: string = "pending"): SubmissionRow[] {
    const startedAt = Date.now() - 20_000;
    return [
        {
            id: "sub-a",
            player_id: PLAYER_A,
            from_x: 0,
            from_y: 0,
            to_x: 0,
            to_y: 1,
            submitted_at: new Date(startedAt + 1_000).toISOString(),
            status,
        },
        {
            id: "sub-b",
            player_id: PLAYER_B,
            from_x: 5,
            from_y: 5,
            to_x: 5,
            to_y: 6,
            submitted_at: new Date(startedAt + 2_000).toISOString(),
            status,
        },
    ];
}

describe("recoverStuckRound", () => {
    beforeEach(() => {
        vi.mocked(getServiceRoleClient).mockReset();
        vi.mocked(completeMatchInternal).mockClear();
        vi.mocked(computeWordScoresForRound).mockClear();
        vi.mocked(publishRoundSummary).mockClear();
        vi.mocked(publishMatchState).mockClear();
    });

    describe("shape A: round stuck in 'resolving'", () => {
        it("runs scoring when word_score_entries is empty, marks round completed, advances match, calls completeMatchInternal", async () => {
            const { client, matchUpdates, roundUpdates, submissionUpdates } = buildMockClient({
                match: baseMatch(),
                round: baseRound({ state: "resolving" }),
                submissions: baseSubmissions("pending"),
                existingWordEntries: [],
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).toHaveBeenCalledTimes(1);
            // Both pending submissions → promoted to accepted
            expect(submissionUpdates.some((u) => u.id === "sub-a" && u.patch.status === "accepted")).toBe(true);
            expect(submissionUpdates.some((u) => u.id === "sub-b" && u.patch.status === "accepted")).toBe(true);
            // Round marked completed
            expect(roundUpdates.some((u) => u.state === "completed")).toBe(true);
            // Match advanced to completed (round 10 is terminal)
            expect(matchUpdates.some((u) => u.state === "completed" && u.current_round === 11)).toBe(true);
            // scoreboard_snapshots written via publishRoundSummary before completeMatchInternal
            expect(publishRoundSummary).toHaveBeenCalledWith(MATCH_ID, 10);
            // completeMatchInternal called with round_limit
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
        });

        it("skips re-scoring when word_score_entries already present (idempotency)", async () => {
            const { client } = buildMockClient({
                match: baseMatch(),
                round: baseRound({ state: "resolving" }),
                submissions: baseSubmissions("accepted"),
                existingWordEntries: [{ id: "existing-word-entry" }],
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).not.toHaveBeenCalled();
            // Snapshot still missing → publishRoundSummary backfills it
            expect(publishRoundSummary).toHaveBeenCalledWith(MATCH_ID, 10);
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
        });
    });

    describe("shape B: round completed but match still in_progress", () => {
        it("advances match to completed when current_round is 10, calls publishRoundSummary + completeMatchInternal", async () => {
            const { client, matchUpdates } = buildMockClient({
                match: baseMatch({ current_round: 10 }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(matchUpdates.some((u) => u.state === "completed" && u.current_round === 11)).toBe(true);
            // Timer deductions computed from submissions (sub at +1s/+2s from started_at −20s)
            // playerA: 120000 − 1000 = 119000; playerB: 110000 − 2000 = 108000
            const updatedMatch = matchUpdates.find((u) => u.state === "completed");
            expect(updatedMatch?.player_a_timer_ms).toBe(119_000);
            expect(updatedMatch?.player_b_timer_ms).toBe(108_000);
            // scoreboard_snapshots backfilled before the match is finalised
            expect(publishRoundSummary).toHaveBeenCalledWith(MATCH_ID, 10);
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
        });

        it("skips publishRoundSummary when scoreboard_snapshots already exists for the round", async () => {
            const { client } = buildMockClient({
                match: baseMatch({ current_round: 10 }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
                existingSnapshot: { round_number: 10 },
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(publishRoundSummary).not.toHaveBeenCalled();
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
        });

        it("does not call completeMatchInternal for non-terminal rounds (relies on submit-retry path)", async () => {
            const { client, matchUpdates } = buildMockClient({
                match: baseMatch({ current_round: 5 }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(completeMatchInternal).not.toHaveBeenCalled();
            // Match updated to next round (current_round=6) but not completed
            expect(matchUpdates.some((u) => u.current_round === 6 && u.state !== "completed")).toBe(true);
            // And the snapshot for round 5 gets backfilled for the chart
            expect(publishRoundSummary).toHaveBeenCalledWith(MATCH_ID, 5);
        });
    });

    describe("shape C: match completed but winner_id null", () => {
        it("backfills round-10 scoreboard_snapshots then calls completeMatchInternal", async () => {
            const { client } = buildMockClient({
                match: baseMatch({ state: "completed", winner_id: null, current_round: 11 }),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            // match.current_round is 11 (post-game-over); the "last played"
            // round is 10 — that's where a missing snapshot would live.
            expect(publishRoundSummary).toHaveBeenCalledWith(MATCH_ID, 10);
            expect(completeMatchInternal).toHaveBeenCalledTimes(1);
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
            // Scoring should NOT be re-run
            expect(computeWordScoresForRound).not.toHaveBeenCalled();
        });

        it("skips publishRoundSummary in shape C when scoreboard_snapshots for the last round already exists", async () => {
            const { client } = buildMockClient({
                match: baseMatch({ state: "completed", winner_id: null, current_round: 11 }),
                existingSnapshot: { round_number: 10 },
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(publishRoundSummary).not.toHaveBeenCalled();
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
        });

        it("is a no-op when match is completed and winner_id is already set", async () => {
            const { client, matchUpdates, roundUpdates } = buildMockClient({
                match: baseMatch({ state: "completed", winner_id: PLAYER_A, current_round: 11 }),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(completeMatchInternal).not.toHaveBeenCalled();
            expect(publishRoundSummary).not.toHaveBeenCalled();
            expect(matchUpdates).toHaveLength(0);
            expect(roundUpdates).toHaveLength(0);
        });
    });

    describe("idempotency", () => {
        it("running recoverStuckRound twice produces no extra scoring or completeMatchInternal calls on second run", async () => {
            // First run: shape A → scoring + complete match
            const ctx1 = buildMockClient({
                match: baseMatch(),
                round: baseRound({ state: "resolving" }),
                submissions: baseSubmissions("pending"),
                existingWordEntries: [],
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(ctx1.client);
            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).toHaveBeenCalledTimes(1);
            expect(completeMatchInternal).toHaveBeenCalledTimes(1);

            // Second run: state now reflects completion
            const ctx2 = buildMockClient({
                match: baseMatch({ state: "completed", winner_id: PLAYER_A, current_round: 11 }),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(ctx2.client);
            await recoverStuckRound(MATCH_ID);

            // No additional calls
            expect(computeWordScoresForRound).toHaveBeenCalledTimes(1);
            expect(completeMatchInternal).toHaveBeenCalledTimes(1);
        });
    });
});
