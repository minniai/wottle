import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleClient: vi.fn(),
}));

import { findOrphanedMatches } from "@/lib/match/findOrphanedMatches";
import { getServiceRoleClient } from "@/lib/supabase/server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findOrphanedMatches", () => {
  test("returns ids returned by the SQL function", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: ["match-1", "match-2"],
      error: null,
    });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    const result = await findOrphanedMatches();

    expect(rpc).toHaveBeenCalledWith("find_orphaned_matches");
    expect(result).toEqual(["match-1", "match-2"]);
  });

  test("returns empty array when no orphans exist", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    expect(await findOrphanedMatches()).toEqual([]);
  });

  test("returns empty array when RPC returns null data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    expect(await findOrphanedMatches()).toEqual([]);
  });

  test("throws when the RPC errors", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.mocked(getServiceRoleClient).mockReturnValue({ rpc } as never);

    await expect(findOrphanedMatches()).rejects.toThrow(/boom/);
  });
});
