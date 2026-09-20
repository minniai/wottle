import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/lib/scoring/roundSummary", () => ({ aggregateRoundSummary: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/game-engine/boardGenerator", () => ({
  generateBoard: vi.fn().mockReturnValue(Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "S"))),
}));
vi.mock("@/lib/match/roundEngine", () => ({ advanceRound: vi.fn().mockResolvedValue({ status: "waiting" }) }));
vi.mock("@/lib/match/recoverStuckRound", () => ({ recoverStuckRound: vi.fn().mockResolvedValue(undefined) }));

import { generateBoard } from "@/lib/game-engine/boardGenerator";
import { recoverStuckRound } from "@/lib/match/recoverStuckRound";
import { __resetSelfHealTrackerForTests, lastPlayedRound, loadMatchState } from "@/lib/match/stateLoader";

/**
 * Spec 049 T006/T008 (contracts/state-loader.md). The 20 September defect: a
 * completed match's round pointer names a round that does not exist, and the
 * loader regenerated the board from the seed. The rows below are that match's
 * shape; `S` is what the seed would give and must never be served.
 */
const MATCH_ID = "ed22c625";
const boardOf = (letter: string) => Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => letter));

interface RoundRow {
  id: string;
  round_number: number;
  state: string;
  board_snapshot_before: string[][] | null;
  board_snapshot_after: string[][] | null;
  started_at?: string;
  resolution_started_at?: string | null;
}

/** Ten completed rounds; round n's board_after is the letter of n (round 10 → "J"). */
function tenRounds(): RoundRow[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `r${i + 1}`,
    round_number: i + 1,
    state: "completed",
    board_snapshot_before: boardOf(String.fromCharCode(64 + i)),
    board_snapshot_after: boardOf(String.fromCharCode(65 + i)),
  }));
}

/** A client that answers `rounds` by the round_number asked for and the last-played query by max round. */
function client(match: Record<string, unknown>, rounds: RoundRow[]) {
  const roundsTable = {
    select: vi.fn(() => {
      const filters: Record<string, unknown> = {};
      let notAfterNull = false;
      type Chain = {
        eq: (col: string, val: unknown) => Chain;
        not: (col: string) => Chain;
        order: () => Chain;
        limit: () => Chain;
        maybeSingle: () => Promise<{ data: RoundRow | null; error: null }>;
      };
      const chain: Chain = {
        eq: (col, val) => ((filters[col] = val), chain),
        not: (col) => ((notAfterNull = col === "board_snapshot_after"), chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: vi.fn(async () => {
          if (notAfterNull) {
            const played = rounds.filter((r) => r.board_snapshot_after).sort((a, b) => b.round_number - a.round_number);
            return { data: played[0] ?? null, error: null };
          }
          return { data: rounds.find((r) => r.round_number === filters.round_number) ?? null, error: null };
        }),
      };
      return chain;
    }),
    upsert: vi.fn().mockResolvedValue({}),
  };
  type ScoreChain = { eq: (k: string, v: unknown) => ScoreChain; maybeSingle: () => Promise<unknown> };
  const scoreboards = {
    select: vi.fn(() => {
      const f: Record<string, unknown> = {};
      const c: ScoreChain = {
        eq: (k, v) => ((f[k] = v), c),
        maybeSingle: async () => ({ data: { player_a_score: f.round_number, player_b_score: 0 }, error: null }),
      };
      return c;
    }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "matches") return { select: vi.fn(() => ({ eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: match, error: null }) })), update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })) };
      if (table === "rounds") return roundsTable;
      if (table === "scoreboard_snapshots") return scoreboards;
      if (table === "word_score_entries") return { select: vi.fn(() => ({ eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
      return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })), upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })) };
    }),
  };
}

const match = (over: Record<string, unknown>) => ({
  id: MATCH_ID, state: "completed", current_round: 11, board_seed: "seed", player_a_id: "a", player_b_id: "b",
  player_a_timer_ms: 71_427, player_b_timer_ms: 149_872, frozen_tiles: {}, winner_id: "b", ...over,
});

describe("lastPlayedRound", () => {
  it("is the highest round with a persisted board_snapshot_after", async () => {
    const rounds = tenRounds();
    rounds[9].board_snapshot_after = null; // round 10 still resolving
    expect(await lastPlayedRound(client(match({}), rounds) as never, MATCH_ID)).toMatchObject({ roundNumber: 9 });
    expect(await lastPlayedRound(client(match({}), tenRounds()) as never, MATCH_ID)).toMatchObject({ roundNumber: 10 });
  });
  it("is null for a match with no rounds", async () => {
    expect(await lastPlayedRound(client(match({}), []) as never, MATCH_ID)).toBeNull();
  });
});

describe("loadMatchState serves a finished match from its last played round", () => {
  beforeEach(() => {
    vi.mocked(generateBoard).mockClear();
    vi.mocked(recoverStuckRound).mockClear();
    __resetSelfHealTrackerForTests();
  });

  it("completed, current_round 11: round 10's board, scores and pointer 11; never the seed", async () => {
    const state = await loadMatchState(client(match({}), tenRounds()) as never, MATCH_ID);
    expect(state?.board[0][0]).toBe("J");
    expect(state?.scores.playerA).toBe(10);
    expect(state?.currentRound).toBe(11);
    expect(state?.state).toBe("completed");
    expect(generateBoard).not.toHaveBeenCalled();
  });

  it("completed, current_round written back to 6 (the 20 September row): still round 10's board", async () => {
    const state = await loadMatchState(client(match({ current_round: 6, winner_id: null }), tenRounds()) as never, MATCH_ID);
    expect(state?.board[0][0]).toBe("J");
    expect(state?.scores.playerA).toBe(10);
    expect(generateBoard).not.toHaveBeenCalled();
  });

  it("abandoned likewise", async () => {
    const state = await loadMatchState(client(match({ state: "abandoned", current_round: 7 }), tenRounds().slice(0, 6)) as never, MATCH_ID);
    expect(state?.board[0][0]).toBe("F");
    expect(state?.state).toBe("abandoned");
    expect(generateBoard).not.toHaveBeenCalled();
  });

  it("in progress with a missing round row: the last played board, a recovery trigger, no seed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = await loadMatchState(client(match({ state: "in_progress", current_round: 7, winner_id: null }), tenRounds().slice(0, 6)) as never, MATCH_ID);
    expect(state?.board[0][0]).toBe("F");
    expect(state?.currentRound).toBe(7);
    await vi.waitFor(() => expect(recoverStuckRound).toHaveBeenCalledWith(MATCH_ID));
    expect(generateBoard).not.toHaveBeenCalled();
    expect(error.mock.calls.some((c) => String(c[0]).includes("match.round.missing"))).toBe(true);
    error.mockRestore();
  });

  it("in progress with an unreadable snapshot: the previous round's board, logged, no seed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rounds = tenRounds().slice(0, 4);
    rounds.push({ id: "r5", round_number: 5, state: "collecting", board_snapshot_before: [["only"]] as never, board_snapshot_after: null });
    const state = await loadMatchState(client(match({ state: "in_progress", current_round: 5, winner_id: null }), rounds) as never, MATCH_ID);
    expect(state?.board[0][0]).toBe("D");
    expect(generateBoard).not.toHaveBeenCalled();
    expect(error.mock.calls.some((c) => String(c[0]).includes("match.board.unreadable"))).toBe(true);
    error.mockRestore();
  });

  it("a match with no rounds still bootstraps round 1 from the seed", async () => {
    const state = await loadMatchState(client(match({ state: "pending", current_round: 0, winner_id: null }), []) as never, MATCH_ID);
    expect(generateBoard).toHaveBeenCalled();
    expect(state?.board[0][0]).toBe("S");
  });
});
