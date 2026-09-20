import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/app/actions/match/publishRoundSummary", () => ({
  publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
  computeWordScoresForRound: vi.fn().mockResolvedValue({
    wordScores: [],
    finalBoard: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
    newFrozenTiles: {},
  }),
}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({ matchId: "ed22c625" }),
}));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));

import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { publishRoundSummary } from "@/app/actions/match/publishRoundSummary";
import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Spec 049 T010 (contracts/round-end-write.md). On 2026-09-20 a thawed
 * `after()` hook wrote round 5's end onto a match completed two minutes
 * earlier. The step-14 write now carries the round it read and refuses a
 * completed match; zero rows is a warn, not an advance.
 */
const MATCH_ID = "ed22c625";
const board = () => Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A"));

interface Harness {
  client: unknown;
  matchWrites: { payload: Record<string, unknown>; filters: [string, string, unknown][] }[];
}

function harness(match: Record<string, unknown>, affectedRows: number): Harness {
  const matchWrites: Harness["matchWrites"] = [];
  const selectChain = (data: unknown) => ({
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  });
  const submissions = [
    { id: "s-a", player_id: "a", from_x: 0, from_y: 0, to_x: 0, to_y: 1, submitted_at: "2026-09-20T21:19:00Z", status: "pending" },
    { id: "s-b", player_id: "b", from_x: 5, from_y: 5, to_x: 5, to_y: 6, submitted_at: "2026-09-20T21:19:01Z", status: "pending" },
  ];
  const submissionsChain = { eq: vi.fn() };
  submissionsChain.eq.mockReturnValueOnce(submissionsChain).mockResolvedValue({ data: submissions, error: null });
  const thenable = (value: unknown) => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
    chain.select = vi.fn().mockResolvedValue({ data: [{ id: "round-5" }], error: null });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve);
    return chain;
  };
  const matchesUpdate = vi.fn((payload: Record<string, unknown>) => {
    const write = { payload, filters: [] as [string, string, unknown][] };
    matchWrites.push(write);
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn((col: string, val: unknown) => (write.filters.push(["eq", col, val]), chain));
    chain.neq = vi.fn((col: string, val: unknown) => (write.filters.push(["neq", col, val]), chain));
    chain.select = vi.fn().mockResolvedValue({
      data: Array.from({ length: affectedRows }, () => ({ id: MATCH_ID })),
      error: null,
    });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
    return chain;
  });
  const client = {
    from: vi.fn((table: string) => {
      if (table === "matches") return { select: vi.fn(() => selectChain(match)), update: matchesUpdate };
      if (table === "rounds") {
        return {
          select: vi.fn(() => selectChain({ id: "round-5", state: "collecting", board_snapshot_before: board(), started_at: new Date().toISOString(), frozen_tiles_before: {} })),
          update: vi.fn(() => thenable({ error: null })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "move_submissions") {
        return { select: vi.fn(() => submissionsChain), update: vi.fn(() => thenable({ error: null })), insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "scoreboard_snapshots") return { select: vi.fn(() => selectChain({ player_a_score: 0, player_b_score: 0 })) };
      return {};
    }),
    channel: vi.fn(() => ({ send: vi.fn().mockResolvedValue("ok"), unsubscribe: vi.fn() })),
  };
  return { client, matchWrites };
}

const liveMatch = {
  id: MATCH_ID,
  current_round: 5,
  state: "in_progress",
  player_a_id: "a",
  player_b_id: "b",
  board_seed: "seed",
  player_a_timer_ms: 71_427,
  player_b_timer_ms: 149_872,
  frozen_tiles: {},
};

describe("advanceRound step 14 is a compare-and-set on the round it read", () => {
  beforeEach(() => {
    vi.mocked(getServiceRoleClient).mockReset();
    vi.mocked(completeMatchInternal).mockClear();
    vi.mocked(publishRoundSummary).mockClear();
  });

  it("carries the round read at step 1 and refuses a completed match", async () => {
    const h = harness(liveMatch, 1);
    vi.mocked(getServiceRoleClient).mockReturnValue(h.client as never);

    const result = await advanceRound(MATCH_ID);

    expect(result).toMatchObject({ status: "advanced", nextRound: 6 });
    const write = h.matchWrites.find((w) => w.payload.current_round === 6);
    expect(write?.filters).toEqual(
      expect.arrayContaining([
        ["eq", "id", MATCH_ID],
        ["eq", "current_round", 5],
        ["neq", "state", "completed"],
      ]),
    );
  });

  it("a zero-row write logs match.write.stale with what it carried and does not advance", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const h = harness(liveMatch, 0);
    vi.mocked(getServiceRoleClient).mockReturnValue(h.client as never);

    const result = await advanceRound(MATCH_ID);

    expect(result).toEqual({ status: "not_advancing", reason: "stale" });
    expect(publishRoundSummary).not.toHaveBeenCalled();
    expect(completeMatchInternal).not.toHaveBeenCalled();
    const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes("match.write.stale"));
    expect(line).toBeDefined();
    expect(JSON.parse(line as string)).toMatchObject({ matchId: MATCH_ID, roundNumber: 5 });
    expect(line).toContain('"current_round":6');
    log.mockRestore();
  });

  it("a round-5 replay against the 20 September row (completed, current_round 6) writes nothing", async () => {
    const h = harness({ ...liveMatch, state: "completed", current_round: 6 }, 0);
    vi.mocked(getServiceRoleClient).mockReturnValue(h.client as never);

    const result = await advanceRound(MATCH_ID);

    expect(result.status).toBe("not_advancing");
    expect(h.matchWrites).toHaveLength(0);
  });
});
