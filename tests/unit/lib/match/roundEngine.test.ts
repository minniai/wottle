import { describe, it, expect, vi, beforeEach } from "vitest";
import { advanceRound } from "../../../../lib/match/roundEngine";
import { getServiceRoleClient } from "../../../../lib/supabase/server";

// Mock Supabase client
vi.mock("../../../../lib/supabase/server", () => ({
    getServiceRoleClient: vi.fn(),
}));

// Mock publishRoundSummary to avoid database queries in unit tests
vi.mock("@/app/actions/match/publishRoundSummary", () => ({
    publishRoundSummary: vi.fn().mockResolvedValue({ error: "Not tested in unit tests" }),
}));

describe("roundEngine", () => {
    let mockSupabase: any;
    let matchQueryChain: any;
    let roundsQueryChain: any;
    let submissionsQueryChain: any;
    let updateQueryChain: any;
    let submissionsUpdateChain: any;

    beforeEach(() => {
        // Create separate mock chains for different queries
        matchQueryChain = {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
        };

        roundsQueryChain = {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
        };

        submissionsQueryChain = {
            eq: vi.fn(function (this: any) {
                // First call to .eq() returns the chain again
                // Second call returns the data
                if (this.eq.mock.calls.length === 1) {
                    return this;
                }
                return { data: [], error: null };
            }),
        };

        updateQueryChain = {
            eq: vi.fn().mockResolvedValue({ error: null }),
        };

        // Chain for move_submissions updates
        submissionsUpdateChain = {
            eq: vi.fn().mockResolvedValue({ error: null }),
        };

        mockSupabase = {
            from: vi.fn((table: string) => {
                if (table === "matches") {
                    return {
                        select: vi.fn(() => matchQueryChain),
                        update: vi.fn(() => updateQueryChain),
                    };
                }
                if (table === "rounds") {
                    return {
                        select: vi.fn(() => roundsQueryChain),
                        update: vi.fn(() => updateQueryChain),
                        insert: vi.fn().mockResolvedValue({ error: null }),
                    };
                }
                if (table === "move_submissions") {
                    return {
                        select: vi.fn(() => submissionsQueryChain),
                        update: vi.fn(() => submissionsUpdateChain),
                    };
                }
                return {};
            }),
        };

        (getServiceRoleClient as any).mockReturnValue(mockSupabase);
    });

    it("should advance round when 2 submissions are present", async () => {
        // Mock match fetch
        matchQueryChain.single.mockResolvedValueOnce({
            data: { id: "match-1", current_round: 1, state: "in_progress" },
            error: null,
        });

        // Mock round fetch
        roundsQueryChain.single.mockResolvedValueOnce({
            data: { id: "round-1", state: "collecting", board_snapshot_before: Array(10).fill(Array(10).fill("A")) },
            error: null,
        });

        // Mock submissions fetch - the second .eq() call returns the data
        submissionsQueryChain.eq.mockImplementation(function (this: any) {
            if (this.eq.mock.calls.length === 1) {
                return this;
            }
            return Promise.resolve({
                data: [
                    { id: "sub1", player_id: "p1", from_x: 0, from_y: 0, to_x: 0, to_y: 1, submitted_at: "2023-01-01T10:00:00Z" },
                    { id: "sub2", player_id: "p2", from_x: 5, from_y: 5, to_x: 5, to_y: 6, submitted_at: "2023-01-01T10:00:01Z" },
                ],
                error: null,
            });
        });

        const result = await advanceRound("match-1");

        expect(result.status).toBe("advanced");
        expect(result.nextRound).toBe(2);
        expect(mockSupabase.from).toHaveBeenCalledWith("matches");
        expect(mockSupabase.from).toHaveBeenCalledWith("rounds");
        expect(mockSupabase.from).toHaveBeenCalledWith("move_submissions");
    });

    it("should wait when less than 2 submissions", async () => {
        // Mock match fetch
        matchQueryChain.single.mockResolvedValueOnce({
            data: { id: "match-1", current_round: 1, state: "in_progress" },
            error: null,
        });

        // Mock round fetch
        roundsQueryChain.single.mockResolvedValueOnce({
            data: { id: "round-1", state: "collecting", board_snapshot_before: Array(10).fill(Array(10).fill("A")) },
            error: null,
        });

        // Mock submissions fetch - the second .eq() call returns the data
        submissionsQueryChain.eq.mockImplementation(function (this: any) {
            if (this.eq.mock.calls.length === 1) {
                return this;
            }
            return Promise.resolve({
                data: [
                    { id: "sub1", player_id: "p1", from_x: 0, from_y: 0, to_x: 0, to_y: 1, submitted_at: "2023-01-01T10:00:00Z" },
                ],
                error: null,
            });
        });

        const result = await advanceRound("match-1");

        expect(result.status).toBe("waiting");
    });
});
