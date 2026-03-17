import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only before importing submitMove
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/roundEngine", () => ({ advanceRound: vi.fn().mockResolvedValue({ status: "waiting" }) }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/app/actions/match/completeMatch", () => ({
    completeMatchInternal: vi.fn().mockResolvedValue({}),
}));

import { submitMove } from "@/app/actions/match/submitMove";
import { publishMatchState } from "@/lib/match/statePublisher";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";

const PLAYER_ID = "player-a";
const MATCH_ID = "match-1";

function createBoard() {
    return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));
}

function makeSupabaseMock(matchData: Record<string, unknown>, roundData?: Record<string, unknown>) {
    const matchChain = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: matchData, error: null }),
    };

    const roundChain = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
            data: roundData ?? {
                id: "round-1",
                state: "collecting",
                board_snapshot_before: createBoard(),
                // Use current time so player has full timer remaining by default
                started_at: new Date().toISOString(),
            },
            error: null,
        }),
    };

    const existingSubChain = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const insertResult = { error: null };

    return {
        from: vi.fn((table: string) => {
            if (table === "matches") return { select: vi.fn(() => matchChain) };
            if (table === "rounds") return { select: vi.fn(() => roundChain) };
            if (table === "move_submissions") {
                return {
                    select: vi.fn(() => existingSubChain),
                    insert: vi.fn().mockResolvedValue(insertResult),
                };
            }
            return {};
        }),
    };
}

describe("submitMove", () => {
    beforeEach(() => {
        vi.mocked(readLobbySession).mockResolvedValue({
            player: { id: PLAYER_ID, username: "playerA", displayName: "Player A" },
        } as any);
    });

    // T007: submitMove returns { status: "rejected", error: "Match has ended" } when match.state === "completed"
    it("T007: returns rejected with 'Match has ended' when match state is completed", async () => {
        vi.mocked(getServiceRoleClient).mockReturnValue(
            makeSupabaseMock({
                current_round: 10,
                state: "completed",
                player_a_id: PLAYER_ID,
                player_b_id: "player-b",
                frozen_tiles: {},
            }) as never,
        );

        const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

        expect(result).toMatchObject({
            status: "rejected",
            error: "Match has ended",
        });
    });

    it("T007: returns rejected with 'Match has ended' when match state is abandoned", async () => {
        vi.mocked(getServiceRoleClient).mockReturnValue(
            makeSupabaseMock({
                current_round: 10,
                state: "abandoned",
                player_a_id: PLAYER_ID,
                player_b_id: "player-b",
                frozen_tiles: {},
            }) as never,
        );

        const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

        expect(result).toMatchObject({
            status: "rejected",
            error: "Match has ended",
        });
    });

    it("accepts a valid move when match is in_progress", async () => {
        vi.mocked(getServiceRoleClient).mockReturnValue(
            makeSupabaseMock({
                current_round: 1,
                state: "in_progress",
                player_a_id: PLAYER_ID,
                player_b_id: "player-b",
                frozen_tiles: {},
                player_a_timer_ms: 300_000,
                player_b_timer_ms: 300_000,
            }) as never,
        );

        const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

        expect(result).toMatchObject({ status: "accepted" });
        expect(publishMatchState).toHaveBeenCalledWith(MATCH_ID);
    });

    // T015: submitMove returns rejected when clock is expired
    it("T015: returns rejected with 'Your time has expired' when player clock is expired", async () => {
        // Round started 10 minutes ago, but player only had 1 minute - clock is expired
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        vi.mocked(getServiceRoleClient).mockReturnValue(
            makeSupabaseMock(
                {
                    current_round: 1,
                    state: "in_progress",
                    player_a_id: PLAYER_ID,
                    player_b_id: "player-b",
                    frozen_tiles: {},
                    player_a_timer_ms: 60_000, // 1 minute
                    player_b_timer_ms: 300_000,
                },
                {
                    id: "round-1",
                    state: "collecting",
                    board_snapshot_before: createBoard(),
                    started_at: tenMinutesAgo, // started 10 mins ago
                },
            ) as never,
        );

        const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

        expect(result).toMatchObject({
            status: "rejected",
            error: "Your time has expired",
        });
    });

    // T024: expired clock triggers advanceRound so the server can synthesize a
    // timeout pass or complete the match if both players are flagged.
    it("T024: triggers advanceRound when the current player's clock is expired", async () => {
        const { advanceRound } = await import("@/lib/match/roundEngine");
        vi.mocked(advanceRound).mockClear();

        // Both players' timers expired (round started 10 mins ago, both had only 60s)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        vi.mocked(getServiceRoleClient).mockReturnValue(
            makeSupabaseMock(
                {
                    current_round: 1,
                    state: "in_progress",
                    player_a_id: PLAYER_ID,
                    player_b_id: "player-b",
                    frozen_tiles: {},
                    player_a_timer_ms: 60_000,
                    player_b_timer_ms: 60_000, // both expired
                },
                {
                    id: "round-1",
                    state: "collecting",
                    board_snapshot_before: createBoard(),
                    started_at: tenMinutesAgo,
                },
            ) as never,
        );

        const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

        expect(result).toMatchObject({ status: "rejected" });
        expect(advanceRound).toHaveBeenCalledWith(MATCH_ID);
    });

    it("T015: accepts a move when clock has not expired", async () => {
        // Round started 30 seconds ago, player has 60 seconds - clock is still running
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        vi.mocked(getServiceRoleClient).mockReturnValue(
            makeSupabaseMock(
                {
                    current_round: 1,
                    state: "in_progress",
                    player_a_id: PLAYER_ID,
                    player_b_id: "player-b",
                    frozen_tiles: {},
                    player_a_timer_ms: 60_000, // 1 minute
                    player_b_timer_ms: 300_000,
                },
                {
                    id: "round-1",
                    state: "collecting",
                    board_snapshot_before: createBoard(),
                    started_at: thirtySecondsAgo, // started 30 seconds ago
                },
            ) as never,
        );

        const result = await submitMove(MATCH_ID, 0, 0, 0, 1);

        expect(result).toMatchObject({ status: "accepted" });
    });
});
