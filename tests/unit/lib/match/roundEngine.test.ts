import { describe, it, expect, vi, beforeEach } from "vitest";
import { advanceRound } from "../../../../lib/match/roundEngine";
import { getServiceRoleClient } from "../../../../lib/supabase/server";

// Mock Supabase client
vi.mock("../../../../lib/supabase/server", () => ({
    getServiceRoleClient: vi.fn(),
}));

describe("roundEngine", () => {
    let mockSupabase: any;
    let matchQueryChain: any;
    let submissionsQueryChain: any;
    let updateQueryChain: any;

    beforeEach(() => {
        // Create separate mock chains for different queries
        matchQueryChain = {
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

        mockSupabase = {
            from: vi.fn((table: string) => {
                if (table === "matches") {
                    return {
                        select: vi.fn(() => matchQueryChain),
                        update: vi.fn(() => updateQueryChain),
                    };
                }
                if (table === "move_submissions") {
                    return {
                        select: vi.fn(() => submissionsQueryChain),
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
            data: { id: "match-1", current_round: 1, status: "in_progress" },
            error: null,
        });

        // Mock submissions fetch - the second .eq() call returns the data
        submissionsQueryChain.eq.mockImplementation(function (this: any) {
            if (this.eq.mock.calls.length === 1) {
                return this;
            }
            return Promise.resolve({
                data: [
                    { player_id: "p1", from_x: 0, from_y: 0, to_x: 0, to_y: 1, created_at: "2023-01-01T10:00:00Z" },
                    { player_id: "p2", from_x: 5, from_y: 5, to_x: 5, to_y: 6, created_at: "2023-01-01T10:00:01Z" },
                ],
                error: null,
            });
        });

        const result = await advanceRound("match-1");

        expect(result.status).toBe("advanced");
        expect(result.nextRound).toBe(2);
        expect(mockSupabase.from).toHaveBeenCalledWith("matches");
        expect(mockSupabase.from).toHaveBeenCalledWith("move_submissions");
    });

    it("should wait when less than 2 submissions", async () => {
        // Mock match fetch
        matchQueryChain.single.mockResolvedValueOnce({
            data: { id: "match-1", current_round: 1, status: "in_progress" },
            error: null,
        });

        // Mock submissions fetch - the second .eq() call returns the data
        submissionsQueryChain.eq.mockImplementation(function (this: any) {
            if (this.eq.mock.calls.length === 1) {
                return this;
            }
            return Promise.resolve({
                data: [
                    { player_id: "p1", from_x: 0, from_y: 0, to_x: 0, to_y: 1 },
                ],
                error: null,
            });
        });

        const result = await advanceRound("match-1");

        expect(result.status).toBe("waiting");
    });
});
