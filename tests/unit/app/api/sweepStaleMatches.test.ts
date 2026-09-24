import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/match/findOrphanedMatches", () => ({
  findOrphanedMatches: vi.fn(),
}));

vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn(),
}));
vi.mock("@/lib/match/findDueMatches", () => ({ findDueMatches: vi.fn() }));
vi.mock("@/lib/match/matchSettlement", () => ({ settleMatchIfDue: vi.fn() }));
vi.mock("@/lib/match/findDueTables", () => ({ findDueTables: vi.fn() }));
vi.mock("@/lib/match/tableService", () => ({ voidDueTable: vi.fn() }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/lobby/sweepLobby", () => ({ sweepLobby: vi.fn(async () => ({ gone: [], expired: 0, pruned: 0 })) }));

import { POST } from "@/app/api/cron/sweep-stale-matches/route";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findDueMatches } from "@/lib/match/findDueMatches";
import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";
import { settleMatchIfDue } from "@/lib/match/matchSettlement";
import { findDueTables } from "@/lib/match/findDueTables";
import { voidDueTable } from "@/lib/match/tableService";
import { sweepLobby } from "@/lib/lobby/sweepLobby";

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
  vi.mocked(findDueMatches).mockResolvedValue([]);
  vi.mocked(settleMatchIfDue).mockResolvedValue("completed");
  vi.mocked(findDueTables).mockResolvedValue([]);
  vi.mocked(voidDueTable).mockResolvedValue({ status: "void" });
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
    expect(body).toEqual({ swept: [], failed: [], settled: [], settleFailed: [], voided: [], voidFailed: [], lobby: { gone: [], expired: 0, pruned: 0 } });
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  test("settles every match past its deadline under the normal rules (spec 050)", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue([]);
    vi.mocked(findDueMatches).mockResolvedValue(["due-1", "due-2"]);
    vi.mocked(settleMatchIfDue).mockImplementation(async (id: string) => {
      if (id === "due-2") throw new Error("boom");
      return "completed";
    });

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(settleMatchIfDue).toHaveBeenCalledWith("due-1");
    expect(settleMatchIfDue).toHaveBeenCalledWith("due-2");
    expect(body.settled).toEqual(["due-1"]);
    expect(body.settleFailed).toEqual([{ matchId: "due-2", error: "boom" }]);
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

  test("voids every table whose time to sit down has run out (spec 069 T011)", async () => {
    vi.mocked(findOrphanedMatches).mockResolvedValue([]);
    vi.mocked(findDueTables).mockResolvedValue(["t1", "t2"]);
    vi.mocked(voidDueTable).mockResolvedValueOnce({ status: "void" }).mockRejectedValueOnce(new Error("boom"));

    const res = await POST(buildRequest("Bearer test-secret"));
    const body = await res.json();

    expect(voidDueTable).toHaveBeenCalledWith(expect.objectContaining({ publish: expect.any(Function) }), "t1");
    expect(body.voided).toEqual(["t1"]);
    expect(body.voidFailed).toEqual([{ matchId: "t2", error: "boom" }]);
  });
});

test("settles the lobby too, and a lobby failure does not fail the sweep (spec 070 T041)", async () => {
  process.env.CRON_SECRET = "s3cret";
  vi.mocked(findOrphanedMatches).mockResolvedValue([]);
  vi.mocked(findDueMatches).mockResolvedValue([]);
  vi.mocked(findDueTables).mockResolvedValue([]);
  vi.mocked(sweepLobby).mockResolvedValueOnce({ gone: ["p1"], expired: 1, pruned: 2 });
  const ok = await POST(buildRequest("Bearer s3cret"));
  expect(ok.status).toBe(200);
  expect((await ok.json()).lobby).toEqual({ gone: ["p1"], expired: 1, pruned: 2 });
  vi.mocked(sweepLobby).mockRejectedValueOnce(new Error("db down"));
  const failed = await POST(buildRequest("Bearer s3cret"));
  expect(failed.status).toBe(200);
  expect((await failed.json()).lobby).toEqual({ error: "db down" });
});
