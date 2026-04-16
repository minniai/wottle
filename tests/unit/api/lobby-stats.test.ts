import { afterEach, describe, expect, test, vi } from "vitest";

const getMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: (..._args: unknown[]) => getMock(),
      }),
    }),
  }),
}));

afterEach(() => {
  getMock.mockReset();
});

describe("GET /api/lobby/stats/matches-in-progress", () => {
  test("returns matchesInProgress count and no-store cache header", async () => {
    getMock.mockResolvedValue({ count: 7, error: null });
    const { GET } = await import(
      "@/app/api/lobby/stats/matches-in-progress/route"
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matchesInProgress: number };
    expect(body.matchesInProgress).toBe(7);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  test("returns 0 when Supabase count is null", async () => {
    getMock.mockResolvedValue({ count: null, error: null });
    const { GET } = await import(
      "@/app/api/lobby/stats/matches-in-progress/route"
    );
    const res = await GET();
    const body = (await res.json()) as { matchesInProgress: number };
    expect(body.matchesInProgress).toBe(0);
  });

  test("returns 500 when Supabase reports an error", async () => {
    getMock.mockResolvedValue({
      count: null,
      error: { message: "db down" },
    });
    const { GET } = await import(
      "@/app/api/lobby/stats/matches-in-progress/route"
    );
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
