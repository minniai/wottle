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
vi.mock("@/lib/match/matchIntegrity", async (importActual) => {
    const actual = await importActual<typeof import("@/lib/match/matchIntegrity")>();
    return { ...actual, verifyMatchIntegrity: vi.fn().mockReturnValue([]) };
});

import { verifyMatchIntegrity } from "@/lib/match/matchIntegrity";
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
    board_snapshot_after: string[][] | null;
    started_at: string | null;
    resolution_started_at: string | null;
    frozen_tiles_before?: Record<string, unknown>;
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
    /** What `matches` returns on every read after the first — the row as it is
     *  once scoring has persisted its freezes (spec 047 FR-006). */
    freshMatch?: MatchRow;
    /** Scoreboard snapshots already persisted for the round. `null` (default) =
     *  missing → recovery should call publishRoundSummary. */
    existingSnapshot?: { round_number: number } | null;
    /** Rows the compare-and-set match write reports as affected (spec 049). */
    matchRowsAffected?: number;
}

function buildMockClient({
    match,
    round,
    submissions = [],
    freshMatch,
    existingSnapshot = null,
    matchRowsAffected = 1,
}: BuildClientOpts) {
    let matchReads = 0;
    const readMatch = () => (matchReads++ === 0 ? match : (freshMatch ?? match));
    // Track writes for assertions
    const matchUpdates: Array<Record<string, unknown>> = [];
    const matchWriteFilters: Array<[string, string, unknown]> = [];
    const roundUpdates: Array<Record<string, unknown>> = [];
    const roundInserts: Array<Record<string, unknown>> = [];
    const submissionUpdates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    const from = vi.fn((table: string) => {
        if (table === "matches") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    single: vi.fn(() => Promise.resolve({ data: readMatch(), error: null })),
                    maybeSingle: vi.fn(() => Promise.resolve({ data: readMatch(), error: null })),
                })),
                update: vi.fn((patch: Record<string, unknown>) => {
                    matchUpdates.push(patch);
                    // The advancing write is a compare-and-set that reads the
                    // affected rows (spec 049 contracts/round-end-write.md).
                    const chain: Record<string, unknown> = {};
                    chain.eq = vi.fn((col: string, val: unknown) => (matchWriteFilters.push(["eq", col, val]), chain));
                    chain.neq = vi.fn((col: string, val: unknown) => (matchWriteFilters.push(["neq", col, val]), chain));
                    chain.select = vi.fn().mockResolvedValue({
                        data: Array.from({ length: matchRowsAffected }, () => ({ id: match.id })),
                        error: null,
                    });
                    (chain as { then: unknown }).then = (onFulfilled: (v: { error: null }) => unknown) =>
                        Promise.resolve({ error: null }).then(onFulfilled);
                    return chain;
                }),
            };
        }
        if (table === "rounds") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    lte: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: round ?? null, error: round ? null : { message: "not found" } }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: round ?? null, error: null }),
                    // The integrity check's list read (spec 049)
                    then: (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
                        Promise.resolve({ data: round ? [{ id: round.id, round_number: match.current_round, board_snapshot_after: round.board_snapshot_after }] : [], error: null }).then(onFulfilled),
                })),
                update: vi.fn((patch: Record<string, unknown>) => {
                    roundUpdates.push(patch);
                    return { eq: vi.fn().mockResolvedValue({ error: null }) };
                }),
                insert: vi.fn((payload: Record<string, unknown>) => {
                    roundInserts.push(payload);
                    return Promise.resolve({ error: null });
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
        if (table === "scoreboard_snapshots") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: existingSnapshot, error: null }),
                })),
            };
        }
        if (table === "word_score_entries") {
            return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
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
        matchWriteFilters,
        roundUpdates,
        roundInserts,
        submissionUpdates,
    };
}

const BOARD = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
const BOARD_AFTER = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "B"));

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
        board_snapshot_after: BOARD_AFTER,
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
        vi.mocked(verifyMatchIntegrity).mockReset().mockReturnValue([]);
    });

    describe("shape A: round stuck in 'resolving'", () => {
        // Spec 049 T016: recovery checks the board it re-scored; a failure is
        // logged and this invocation opens no next round.
        it("checks the re-scored board's integrity; a failure logs and advances nothing", async () => {
            const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
            vi.mocked(verifyMatchIntegrity).mockReturnValue([
                { kind: "immutability", cell: "0,0", expected: "B", found: "A" },
            ]);
            const { client, matchUpdates, roundInserts, roundUpdates } = buildMockClient({
                match: baseMatch({ current_round: 5 }),
                round: baseRound({ state: "resolving", board_snapshot_after: null }),
                submissions: baseSubmissions("pending"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).toHaveBeenCalledTimes(1);
            expect(verifyMatchIntegrity).toHaveBeenCalledTimes(1);
            expect(vi.mocked(verifyMatchIntegrity).mock.calls[0][0].board).toEqual(BOARD);
            expect(roundUpdates.some((u) => u.state === "completed")).toBe(true);
            expect(roundInserts).toHaveLength(0);
            expect(matchUpdates).toHaveLength(0);
            expect(completeMatchInternal).not.toHaveBeenCalled();
            const line = error.mock.calls.map((c) => String(c[0])).find((l) => l.includes("match.integrity.failed"));
            expect(JSON.parse(line as string)).toMatchObject({ matchId: MATCH_ID, roundNumber: 5 });
            error.mockRestore();
        });

        it("does not run the check when it did not re-score", async () => {
            const { client } = buildMockClient({
                match: baseMatch({ current_round: 5 }),
                round: baseRound({ state: "resolving" }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(verifyMatchIntegrity).not.toHaveBeenCalled();
        });

        it("runs scoring when board_snapshot_after is missing, marks round completed, advances match, calls completeMatchInternal", async () => {
            const { client, matchUpdates, roundUpdates, submissionUpdates } = buildMockClient({
                match: baseMatch(),
                round: baseRound({ state: "resolving", board_snapshot_after: null }),
                submissions: baseSubmissions("pending"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).toHaveBeenCalledTimes(1);
            // The combined pass's marker is written, so a second recovery is idempotent
            expect(roundUpdates.find((u) => u.state === "completed")?.board_snapshot_after).toEqual(BOARD);
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

        // Spec 047 FR-006: `board_snapshot_after` is written only by the combined
        // scoring pass, so it — not the presence of word_score_entries rows, which
        // the first mover's fast path also writes — says whether scoring ran.
        it("skips re-scoring when board_snapshot_after is already persisted (idempotency)", async () => {
            const { client } = buildMockClient({
                match: baseMatch(),
                round: baseRound({ state: "resolving", board_snapshot_after: BOARD_AFTER }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).not.toHaveBeenCalled();
            // Snapshot still missing → publishRoundSummary backfills it
            expect(publishRoundSummary).toHaveBeenCalledWith(MATCH_ID, 10);
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
        });

        it("re-runs the combined scoring when only the first mover's fast-path rows exist", async () => {
            // The fast path writes word_score_entries but never board_snapshot_after.
            const { client, roundUpdates } = buildMockClient({
                match: baseMatch({ current_round: 4 }),
                round: baseRound({ state: "resolving", board_snapshot_after: null }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(computeWordScoresForRound).toHaveBeenCalledTimes(1);
            expect(roundUpdates.find((u) => u.state === "completed")?.board_snapshot_after).toEqual(BOARD);
        });

        it("scores against the round's own freeze baseline, not the match row's current map", async () => {
            const roundBaseline = { "3,3": { owner: PLAYER_B } };
            const { client } = buildMockClient({
                // The match row already carries a later (or polluted) map.
                match: baseMatch({ current_round: 4, frozen_tiles: { "3,3": { owner: PLAYER_B }, "7,7": { owner: PLAYER_A } } }),
                round: baseRound({ state: "resolving", board_snapshot_after: null, frozen_tiles_before: roundBaseline }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(vi.mocked(computeWordScoresForRound).mock.calls[0]?.[7]).toEqual(roundBaseline);
        });

        it("seeds the next round's freeze baseline from a fresh read after scoring", async () => {
            const preScoring = { "0,0": { owner: PLAYER_A } };
            const postScoring = { "0,0": { owner: PLAYER_A }, "5,5": { owner: PLAYER_B } };
            const { client, roundInserts } = buildMockClient({
                match: baseMatch({ current_round: 4, frozen_tiles: preScoring }),
                freshMatch: baseMatch({ current_round: 4, frozen_tiles: postScoring }),
                round: baseRound({ state: "resolving", board_snapshot_after: null }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(roundInserts).toHaveLength(1);
            expect(roundInserts[0]?.frozen_tiles_before).toEqual(postScoring);
            // and the next round starts from the scored board, not the pre-swap one
            expect(roundInserts[0]?.board_snapshot_before).toEqual(BOARD);
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

        // O-79: when recovery advances current_round for a non-terminal round it
        // MUST also create the next round row — otherwise current_round points at
        // a round that doesn't exist, every submitMove returns "Round not found",
        // and loadMatchState falls back to the regenerated initial board.
        it("creates the next round row before advancing the match (non-terminal)", async () => {
            const { client, matchUpdates, roundInserts } = buildMockClient({
                match: baseMatch({ current_round: 6, frozen_tiles: { "0,0": { owner: PLAYER_A } } }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            // Round 7 row inserted, seeded from the completed round's post-board
            expect(roundInserts).toHaveLength(1);
            const inserted = roundInserts[0];
            expect(inserted.match_id).toBe(MATCH_ID);
            expect(inserted.round_number).toBe(7);
            expect(inserted.state).toBe("collecting");
            expect(inserted.board_snapshot_before).toEqual(BOARD_AFTER);
            expect(inserted.frozen_tiles_before).toEqual({ "0,0": { owner: PLAYER_A } });
            expect(inserted.started_at).toBeTruthy();

            // Match advanced to round 7, still in progress
            expect(matchUpdates.some((u) => u.current_round === 7 && u.state !== "completed")).toBe(true);
        });

        // Spec 049 T012: recovery's advancing write carries the same conditions
        // as advanceRound step 14 and changes nothing when the row moved on.
        it("advances with a compare-and-set on the round it read and on the match not being completed", async () => {
            const { client, matchWriteFilters } = buildMockClient({
                match: baseMatch({ current_round: 5 }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(matchWriteFilters).toEqual(
                expect.arrayContaining([
                    ["eq", "id", MATCH_ID],
                    ["eq", "current_round", 5],
                    ["neq", "state", "completed"],
                ]),
            );
        });

        it("a zero-row advancing write logs match.write.stale and does not complete the match", async () => {
            const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
            const { client, roundInserts } = buildMockClient({
                match: baseMatch({ current_round: 10 }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
                matchRowsAffected: 0,
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(completeMatchInternal).not.toHaveBeenCalled();
            expect(roundInserts).toHaveLength(0);
            const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes("match.write.stale"));
            expect(line).toBeDefined();
            expect(JSON.parse(line as string)).toMatchObject({ matchId: MATCH_ID, roundNumber: 10 });
            log.mockRestore();
        });

        it("does not create a next round when the recovered round is terminal (round 10)", async () => {
            const { client, roundInserts } = buildMockClient({
                match: baseMatch({ current_round: 10 }),
                round: baseRound({ state: "completed" }),
                submissions: baseSubmissions("accepted"),
            });
            vi.mocked(getServiceRoleClient).mockReturnValue(client);

            await recoverStuckRound(MATCH_ID);

            expect(roundInserts).toHaveLength(0);
            expect(completeMatchInternal).toHaveBeenCalledWith(MATCH_ID, "round_limit");
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
                round: baseRound({ state: "resolving", board_snapshot_after: null }),
                submissions: baseSubmissions("pending"),
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
