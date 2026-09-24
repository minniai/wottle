import { describe, expect, it } from "vitest";

import { toMovesResponse, type MatchRow, type MoveRow } from "@/lib/review/movesRepository";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const board = (mark: string) => Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (x + y === 0 ? mark : "x")));

const MATCH: MatchRow = {
  id: "m1", state: "completed", ended_reason: "moves_complete", language: "is", board: board("F"),
  player_a_id: A, player_b_id: B, started_at: "2026-09-24T12:00:00.000Z", deadline_at: "2026-09-24T12:05:00.000Z",
  move_limit: 10, completed_at: "2026-09-24T12:04:52.000Z", winner_id: A, player_a_score: 30, player_b_score: 0,
};

function move(over: Partial<MoveRow>): MoveRow {
  return {
    id: "mv", player_id: A, global_seq: 1, seq: 1, status: "resolved", rejection_reason: null,
    from_x: 1, from_y: 2, to_x: 1, to_y: 3, received_at: "2026-09-24T12:00:10.000Z",
    board_before: board("0"), board_after: board("1"), frozen_after: { "1,2": { owner: "player_a" } },
    score_a_after: 30, score_b_after: 0, delta: 30,
    word_score_entries: [{ player_id: A, word: "lek", length: 3, letters_points: 25, bonus_points: 5, total_points: 30, tiles: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }] }],
    ...over,
  };
}

describe("toMovesResponse", () => {
  const names = new Map([[A, "Birna"], [B, "Kári"]]);

  it("maps a completed match and its moves in receipt order", () => {
    const res = toMovesResponse(MATCH, [move({ global_seq: 2, id: "b", player_id: B, seq: 1 }), move({})], names)!;
    expect(res.moves.map((m) => m.globalSeq)).toEqual([1, 2]);
    expect(res.moves[0]).toMatchObject({ slot: "player_a", seq: 1, swap: { from: { x: 1, y: 2 }, to: { x: 1, y: 3 } }, scoreAfter: { a: 30, b: 0 } });
    expect(res.moves[1].slot).toBe("player_b");
    expect(res.moves[0].words[0]).toMatchObject({ playerId: A, word: "lek", totalPoints: 30 });
    expect(res.durationMs).toBe(300_000);
    expect(res.finalScores).toEqual({ a: 30, b: 0 });
    expect(res.players).toEqual({ a: { id: A, displayName: "Birna" }, b: { id: B, displayName: "Kári" } });
  });

  it("starts from the first move's board, or the match's board when nobody moved", () => {
    expect(toMovesResponse(MATCH, [move({})], names)!.initialBoard[0][0]).toBe("0");
    expect(toMovesResponse(MATCH, [], names)!.initialBoard[0][0]).toBe("F");
  });

  it("keeps refused moves and drops moves that never finished", () => {
    const res = toMovesResponse(MATCH, [move({}), move({ id: "r", global_seq: 2, status: "rejected", seq: null, rejection_reason: "frozen", word_score_entries: [] }), move({ id: "p", global_seq: 3, status: "pending" })], names)!;
    expect(res.moves.map((m) => m.status)).toEqual(["resolved", "rejected"]);
    expect(res.moves[1].rejectionReason).toBe("frozen");
  });

  it.each([
    ["in_progress", "moves_complete"],
    ["pending", null],
    ["completed", "void"],
  ])("serves nothing for a %s match ending %s", (state, reason) => {
    expect(toMovesResponse({ ...MATCH, state, ended_reason: reason }, [move({})], names)).toBeNull();
  });
});
