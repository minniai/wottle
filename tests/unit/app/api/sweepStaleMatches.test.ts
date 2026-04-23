import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/match/findOrphanedMatches", () => ({
  findOrphanedMatches: vi.fn(),
}));

vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn(),
}));

import { POST } from "@/app/api/cron/sweep-stale-matches/route";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function buildRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("authorization", authHeader);
  }
  return new Request("http://localhost/api/cron/sweep-stale-matches", {
    method: "POST",
    headers,
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

describe("POST /api/cron/sweep-stale-matches", () => {
  test("returns 401 when authorization header is missing", async () => {
    const res = await POST(buildRequest());

    expect(res.status).toBe(401);
    expect(findOrphanedMatches).not.toHaveBeenCalled();
  });

  test("returns 401 when bearer token mismatches", async () => {
    const res = await POST(buildRequest("Bearer wrong"));

    expect(res.status).toBe(401);
    expect(findOrphanedMatches).not.toHaveBeenCalled();
  });

  test("returns 500 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;

    const res = await POST(buildRequest("Bearer anything"));

    expect(res.status).toBe(500);
    expect(findOrphanedMatches).not.toHaveBeenCalled();
  });

  test("returns 200 with empty result when there are no orphans", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue([]);

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ swept: [], failed: [] });
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  test("finalises every orphan match", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue(["m-1", "m-2"]);
    vi.mocked(completeMatchInternal).mockResolvedValue({} as never);

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(completeMatchInternal).toHaveBeenCalledTimes(2);
    expect(completeMatchInternal).toHaveBeenCalledWith("m-1", "abandoned");
    expect(completeMatchInternal).toHaveBeenCalledWith("m-2", "abandoned");
    expect(body.swept).toEqual(["m-1", "m-2"]);
    expect(body.failed).toEqual([]);
  });

  test("continues past per-match failures and reports them", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue(["m-ok", "m-bad", "m-ok-2"]);
    vi.mocked(completeMatchInternal).mockImplementation(async (id: string) => {
      if (id === "m-bad") throw new Error("boom");
      return {} as never;
    });

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.swept).toEqual(["m-ok", "m-ok-2"]);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]).toEqual({ matchId: "m-bad", error: "boom" });
  });

  test("returns 500 when find_orphaned_matches throws", async () => {
    vi.mocked(findOrphanedMatches).mockRejectedValue(new Error("rpc down"));

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/rpc down/);
  });
});
