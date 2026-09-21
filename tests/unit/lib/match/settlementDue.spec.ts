import { describe, expect, it } from "vitest";

import { isSettlementDue } from "@/lib/match/stateLoader";

/**
 * The loader's self-heal (spec 050 contracts/settlement.md): a match in
 * progress is due once both players have the move limit, or once its deadline
 * has passed. Either way `settleMatchIfDue` decides for real under the lock.
 */
const NOW = Date.parse("2026-09-21T12:00:00.000Z");
const row = (over: Partial<Parameters<typeof isSettlementDue>[0]> = {}) => ({
  state: "in_progress" as const,
  deadline_at: "2026-09-21T12:03:00.000Z",
  player_a_moves: 4,
  player_b_moves: 6,
  move_limit: 10,
  ...over,
});

describe("isSettlementDue", () => {
  it("is not due while the clock runs and a player is short", () => {
    expect(isSettlementDue(row({ player_a_moves: 10, player_b_moves: 9 }), NOW)).toBe(false);
  });
  it("is due once both have the move limit, before the deadline", () => {
    expect(isSettlementDue(row({ player_a_moves: 10, player_b_moves: 10 }), NOW)).toBe(true);
  });
  it("is due once the deadline has passed", () => {
    expect(isSettlementDue(row({ deadline_at: "2026-09-21T11:59:59.000Z" }), NOW)).toBe(true);
  });
  it("is never due for a match that is not in progress", () => {
    expect(isSettlementDue(row({ state: "completed", player_a_moves: 10, player_b_moves: 10 }), NOW)).toBe(false);
    expect(isSettlementDue(row({ state: "pending", deadline_at: null }), NOW)).toBe(false);
  });
});
