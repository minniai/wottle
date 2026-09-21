import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/match/moveResolver", () => ({ resolvePendingMoves: vi.fn() }));
vi.mock("@/lib/match/findDueMatches", () => ({ findDueMatches: vi.fn() }));
vi.mock("@/app/actions/match/completeMatch", () => ({ completeMatchInternal: vi.fn() }));

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { findDueMatches } from "@/lib/match/findDueMatches";
import { settleMatchIfDue } from "@/lib/match/matchSettlement";
import { resolvePendingMoves } from "@/lib/match/moveResolver";
import { getServiceRoleClient } from "@/lib/supabase/server";

/** Spec 050 contracts/settlement.md. */
const MATCH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function withRow(row: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  vi.mocked(getServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ select })) } as never);
}

const live = (a: number, b: number) => ({ state: "in_progress", player_a_moves: a, player_b_moves: b, move_limit: 10 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolvePendingMoves).mockResolvedValue({ resolved: 0, bothDone: false });
  vi.mocked(findDueMatches).mockResolvedValue([]);
  vi.mocked(completeMatchInternal).mockResolvedValue({ applied: true, endedReason: "moves_complete" } as never);
});

describe("settleMatchIfDue", () => {
  it("drains pending moves before deciding anything", async () => {
    withRow(live(3, 4));
    await settleMatchIfDue(MATCH);
    expect(resolvePendingMoves).toHaveBeenCalledWith(MATCH);
    expect(vi.mocked(resolvePendingMoves).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getServiceRoleClient).mock.invocationCallOrder[0],
    );
  });

  it("completes naturally when both players have the move limit", async () => {
    withRow(live(10, 10));
    expect(await settleMatchIfDue(MATCH)).toBe("completed");
    expect(completeMatchInternal).toHaveBeenCalledWith(MATCH, "natural");
  });

  it("completes when the last drained move brought both to the limit", async () => {
    vi.mocked(resolvePendingMoves).mockResolvedValue({ resolved: 1, bothDone: true });
    withRow(live(10, 9)); // a stale read; the resolver's word wins
    expect(await settleMatchIfDue(MATCH)).toBe("completed");
  });

  it("completes when the database says the deadline has passed", async () => {
    withRow(live(6, 10));
    vi.mocked(findDueMatches).mockResolvedValue([MATCH]);
    expect(await settleMatchIfDue(MATCH)).toBe("completed");
    expect(completeMatchInternal).toHaveBeenCalledWith(MATCH, "natural");
  });

  it("is not due while the clock runs and a player is short", async () => {
    withRow(live(6, 10));
    expect(await settleMatchIfDue(MATCH)).toBe("not_due");
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  it("never completes a match that is already completed or abandoned", async () => {
    withRow({ ...live(10, 10), state: "completed" });
    expect(await settleMatchIfDue(MATCH)).toBe("already");
    withRow({ ...live(10, 10), state: "abandoned" });
    expect(await settleMatchIfDue(MATCH)).toBe("already");
    expect(completeMatchInternal).not.toHaveBeenCalled();
  });

  it("never completes a match that has not started", async () => {
    withRow({ ...live(0, 0), state: "pending" });
    vi.mocked(findDueMatches).mockResolvedValue([MATCH]);
    expect(await settleMatchIfDue(MATCH)).toBe("not_due");
  });

  it("reports `already` when the completion CAS found the match abandoned first (FR-011a)", async () => {
    withRow(live(10, 10));
    vi.mocked(completeMatchInternal).mockResolvedValue({ applied: false, endedReason: "abandoned" } as never);
    expect(await settleMatchIfDue(MATCH)).toBe("already");
  });
});

describe("settleMatchIfDue when another settlement flipped the row first", () => {
  it("reports `already`: only the caller that applied the completion says `completed`", async () => {
    withRow(live(10, 10));
    vi.mocked(completeMatchInternal).mockResolvedValue({ applied: false, endedReason: "moves_complete" } as never);
    expect(await settleMatchIfDue(MATCH)).toBe("already");
  });
});
