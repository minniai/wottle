import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/match/[matchId]/move/route";
import { RateLimitExceededError } from "@/lib/rate-limiting/middleware";

vi.mock("@/app/actions/match/submitMove", () => ({
  submitMove: vi.fn(),
}));

import { submitMove } from "@/app/actions/match/submitMove";

/** Spec 050 contracts/receive-move.md. */
const BODY = { fromX: 0, fromY: 0, toX: 1, toY: 1, fromLetter: "A", toLetter: "B" };

function post(body: unknown) {
  const req = new NextRequest("http://localhost/api/match/123/move", { method: "POST", body: JSON.stringify(body) });
  return POST(req, { params: Promise.resolve({ matchId: "123" }) });
}

describe("POST /api/match/[matchId]/move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the receipt when the move is accepted", async () => {
    vi.mocked(submitMove).mockResolvedValue({
      status: "accepted",
      moveId: "44444444-4444-4444-8444-444444444444",
      globalSeq: 7,
      receivedAt: "2026-09-21T12:00:00.000Z",
    });

    const res = await post(BODY);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      status: "accepted",
      moveId: "44444444-4444-4444-8444-444444444444",
      globalSeq: 7,
      receivedAt: "2026-09-21T12:00:00.000Z",
    });
    expect(submitMove).toHaveBeenCalledWith("123", BODY);
  });

  it("returns 400 when the body lacks the two letters or is out of range", async () => {
    expect((await post({ fromX: 0, fromY: 0, toX: 1, toY: 1 })).status).toBe(400);
    expect((await post({ ...BODY, toX: 10 })).status).toBe(400);
    expect((await post({ ...BODY, fromLetter: "AB" })).status).toBe(400);
    expect(submitMove).not.toHaveBeenCalled();
  });

  it("returns 400 with the message when the action reports an error", async () => {
    vi.mocked(submitMove).mockResolvedValue({ error: "Match not found" });

    const res = await post(BODY);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Match not found" });
  });

  it("returns 400 with the reason when the move is refused", async () => {
    vi.mocked(submitMove).mockResolvedValue({ status: "rejected", reason: "in_flight", error: "Your previous move is still being scored" });

    const res = await post(BODY);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.status).toBe("rejected");
    expect(json.reason).toBe("in_flight");
    expect(json.error).toMatch(/still being scored/);
  });

  it("returns 429 with retry-after when the rate limiter blocks the request", async () => {
    vi.mocked(submitMove).mockRejectedValue(
      new RateLimitExceededError("match:submit-move", 12, "Too many move submissions. Try again soon."),
    );

    const res = await post(BODY);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect((await res.json()).error).toMatch(/too many/i);
  });
});
