import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only before importing submitMove
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/matchmaking/profile", () => ({ readLobbySession: vi.fn() }));
vi.mock("@/lib/rate-limiting/middleware", () => ({ assertWithinRateLimit: vi.fn() }));
vi.mock("@/lib/match/roundEngine", () => ({ advanceRound: vi.fn().mockResolvedValue({ status: "waiting" }) }));

import { submitMove } from "@/app/actions/match/submitMove";
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
                started_at: "2026-01-01T00:00:00Z",
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
    });
});
