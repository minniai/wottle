import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
vi.mock("@/app/actions/match/publishRoundSummary", () => ({
  publishRoundSummary: vi.fn().mockResolvedValue({ ok: true }),
  computeWordScoresForRound: vi.fn().mockResolvedValue({
    wordScores: [],
    finalBoard: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => "A")),
    newFrozenTiles: { "0,0": { owner: "a" } },
  }),
}));
vi.mock("@/app/actions/match/completeMatch", () => ({
  completeMatchInternal: vi.fn().mockResolvedValue({ matchId: "ed22c625" }),
}));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/recoverStuckRound", () => ({ recoverStuckRound: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/matchIntegrity", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/match/matchIntegrity")>();
  return { ...actual, verifyMatchIntegrity: vi.fn().mockReturnValue([]) };
});

import { publishRoundSummary } from "@/app/actions/match/publishRoundSummary";
import { verifyMatchIntegrity } from "@/lib/match/matchIntegrity";
import { recoverStuckRound } from "@/lib/match/recoverStuckRound";
import { advanceRound } from "@/lib/match/roundEngine";
import { getServiceRoleClient } from "@/lib/supabase/server";

/**
 * Spec 049 T014 (contracts/integrity-check.md): after the board is persisted
 * (step 9c) and before the next round opens (step 13), every record must
 * spell on that board and no frozen letter may have moved. A failure is an
 * error event, a hand-off to recovery, and no next round from this call.
 */
const MATCH_ID = "ed22c625";
const board = (letter: string) => Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => letter));

function harness() {
  const roundsInsert = vi.fn().mockResolvedValue({ error: null });
  const selectChain = (single: unknown, list: unknown[] = []) => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.lte = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.single = vi.fn().mockResolvedValue({ data: single, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: single, error: null });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: list, error: null }).then(resolve);
    return chain;
  };
  const thenable = () => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
    chain.select = vi.fn().mockResolvedValue({ data: [{ id: "x" }], error: null });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
    return chain;
  };
  const submissions = [
    { id: "s-a", player_id: "a", from_x: 0, from_y: 0, to_x: 0, to_y: 1, submitted_at: "2026-09-20T21:19:00Z", status: "pending" },
    { id: "s-b", player_id: "b", from_x: 5, from_y: 5, to_x: 5, to_y: 6, submitted_at: "2026-09-20T21:19:01Z", status: "pending" },
  ];
  const submissionsChain = { eq: vi.fn() };
  submissionsChain.eq.mockReturnValueOnce(submissionsChain).mockResolvedValue({ data: submissions, error: null });
  const currentRound = { id: "round-5", state: "collecting", board_snapshot_before: board("B"), started_at: new Date().toISOString(), frozen_tiles_before: {} };
  const roundRows = [
    { id: "round-4", round_number: 4, board_snapshot_after: board("D") },
    { id: "round-5", round_number: 5, board_snapshot_after: null },
  ];
  const records = [
    { id: "w1", round_id: "round-4", word: "dddd", tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
  ];
  const match = { id: MATCH_ID, current_round: 5, state: "in_progress", player_a_id: "a", player_b_id: "b", board_seed: "seed", player_a_timer_ms: 100_000, player_b_timer_ms: 100_000, frozen_tiles: {} };
  const client = {
    from: vi.fn((table: string) => {
      if (table === "matches") return { select: vi.fn(() => selectChain(match)), update: vi.fn(() => thenable()) };
      if (table === "rounds") return { select: vi.fn(() => selectChain(currentRound, roundRows)), update: vi.fn(() => thenable()), insert: roundsInsert };
      if (table === "move_submissions") return { select: vi.fn(() => submissionsChain), update: vi.fn(() => thenable()), insert: vi.fn().mockResolvedValue({ error: null }) };
      if (table === "word_score_entries") return { select: vi.fn(() => selectChain(null, records)) };
      if (table === "scoreboard_snapshots") return { select: vi.fn(() => selectChain({ player_a_score: 0, player_b_score: 0 })) };
      return {};
    }),
    channel: vi.fn(() => ({ send: vi.fn().mockResolvedValue("ok"), unsubscribe: vi.fn() })),
  };
  return { client, roundsInsert };
}

describe("advanceRound checks the match's integrity after the board is persisted", () => {
  beforeEach(() => {
    vi.mocked(getServiceRoleClient).mockReset();
    vi.mocked(verifyMatchIntegrity).mockReset().mockReturnValue([]);
    vi.mocked(recoverStuckRound).mockClear();
    vi.mocked(publishRoundSummary).mockClear();
  });

  it("runs the check on the persisted board, the match's records and the letters at freeze", async () => {
    const h = harness();
    vi.mocked(getServiceRoleClient).mockReturnValue(h.client as never);

    const result = await advanceRound(MATCH_ID);

    expect(result).toMatchObject({ status: "advanced", nextRound: 6 });
    expect(verifyMatchIntegrity).toHaveBeenCalledTimes(1);
    const input = vi.mocked(verifyMatchIntegrity).mock.calls[0][0];
    expect(input.board[0][0]).toBe("A");
    expect(input.records).toEqual([
      expect.objectContaining({ id: "w1", word: "dddd", roundNumber: 4, tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] }),
    ]);
    expect(input.frozenTiles).toEqual({ "0,0": { owner: "a" } });
    expect(input.letterAtFreeze).toEqual({ "0,0": "D", "1,0": "D", "2,0": "D", "3,0": "D" });
    expect(h.roundsInsert).toHaveBeenCalledTimes(1);
  });

  it("a failure is logged, handed to recovery, and opens no next round from this call", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = { kind: "spelling" as const, record: "w1", round: 4, expected: "DDDD", found: "AAAA", cells: "(0,0)…(3,0)" };
    vi.mocked(verifyMatchIntegrity).mockReturnValue([failure]);
    const h = harness();
    vi.mocked(getServiceRoleClient).mockReturnValue(h.client as never);

    const result = await advanceRound(MATCH_ID);

    expect(result).toEqual({ status: "not_advancing", reason: "integrity" });
    expect(recoverStuckRound).toHaveBeenCalledWith(MATCH_ID);
    expect(h.roundsInsert).not.toHaveBeenCalled();
    expect(publishRoundSummary).not.toHaveBeenCalled();
    const line = error.mock.calls.map((c) => String(c[0])).find((l) => l.includes("match.integrity.failed"));
    expect(line).toBeDefined();
    expect(JSON.parse(line as string)).toMatchObject({ matchId: MATCH_ID, roundNumber: 5 });
    expect(line).toContain('"found":"AAAA"');
    error.mockRestore();
  });

  it("a failing records read is not a failing round: logged, the round proceeds", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const h = harness();
    h.client.from.mockImplementation(((table: string) => {
      if (table === "word_score_entries") throw new Error("boom");
      return harness().client.from(table);
    }) as never);
    vi.mocked(getServiceRoleClient).mockReturnValue(h.client as never);

    const result = await advanceRound(MATCH_ID);

    expect(result).toMatchObject({ status: "advanced" });
    expect(recoverStuckRound).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
