import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../../app/api/match/[matchId]/move/route";
import { RateLimitExceededError } from "../../lib/rate-limiting/middleware";

// Mock submitMove action
vi.mock("../../app/actions/match/submitMove", () => ({
    submitMove: vi.fn(),
}));

import { submitMove } from "../../app/actions/match/submitMove";

describe("POST /api/match/[matchId]/move", () => {
    it("should return 200 on success", async () => {
        (submitMove as any).mockResolvedValue({
            status: "accepted",
            grid: Array(10).fill(Array(10).fill("A")),
        });

        const req = new NextRequest("http://localhost/api/match/123/move", {
            method: "POST",
            body: JSON.stringify({ fromX: 0, fromY: 0, toX: 1, toY: 1 }),
        });

        const params = Promise.resolve({ matchId: "123" });
        const res = await POST(req, { params });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe("accepted");
        expect(json.grid).toBeDefined();
    });

    it("should return 400 on invalid body", async () => {
        const req = new NextRequest("http://localhost/api/match/123/move", {
            method: "POST",
            body: JSON.stringify({ fromX: "invalid" }),
        });

        const params = Promise.resolve({ matchId: "123" });
        const res = await POST(req, { params });

        expect(res.status).toBe(400);
    });

    it("should return 400 on action error", async () => {
        (submitMove as any).mockResolvedValue({ error: "Invalid move" });

        const req = new NextRequest("http://localhost/api/match/123/move", {
            method: "POST",
            body: JSON.stringify({ fromX: 0, fromY: 0, toX: 1, toY: 1 }),
        });

        const params = Promise.resolve({ matchId: "123" });
        const res = await POST(req, { params });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("Invalid move");
    });

    it("should return 400 when move result is rejected", async () => {
        (submitMove as any).mockResolvedValue({
            status: "rejected",
            grid: Array(10)
                .fill(null)
                .map(() => Array(10).fill("A")),
            error: "Round closed",
        });

        const req = new NextRequest("http://localhost/api/match/123/move", {
            method: "POST",
            body: JSON.stringify({ fromX: 0, fromY: 0, toX: 1, toY: 1 }),
        });

        const params = Promise.resolve({ matchId: "123" });
        const res = await POST(req, { params });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.status).toBe("rejected");
        expect(json.error).toMatch(/round closed/i);
    });

    it("should return 429 when the rate limiter blocks requests", async () => {
        (submitMove as any).mockRejectedValue(
            new RateLimitExceededError(
                "match:submit-move",
                12,
                "Too many move submissions. Try again soon.",
            ),
        );

        const req = new NextRequest("http://localhost/api/match/123/move", {
            method: "POST",
            body: JSON.stringify({ fromX: 0, fromY: 0, toX: 1, toY: 1 }),
        });

        const params = Promise.resolve({ matchId: "123" });
        const res = await POST(req, { params });

        expect(res.status).toBe(429);
        expect(res.headers.get("retry-after")).toBe("12");
        const json = await res.json();
        expect(json.error).toMatch(/too many/i);
    });
});
