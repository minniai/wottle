import { describe, expect, it } from "vitest";

import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import { timeoutPenalty } from "@/lib/scoring/missPenalty";
import type { MovesResponse } from "@/lib/types/review";

import { bothFinished, movesResponse, rowsFrom } from "./reviewFixtures";

function last<T>(items: T[]): T {
  return items[items.length - 1];
}

/** Eight moves for Birna, ten for Kári, then 0:00: Birna owes two misses. */
function birnaShort(): MovesResponse {
  const specs = Array.from({ length: 18 }, (_, i) => ({ slot: (i % 2 === 0 && i < 16 ? "player_a" : "player_b") as "player_a" | "player_b", at: 5 + i * 15, points: 12 }));
  const rows = rowsFrom(specs);
  const tail = last(rows).scoreAfter;
  return movesResponse(rows, "incomplete", { a: tail.a + timeoutPenalty(tail.a, 2), b: tail.b });
}

describe("buildReviewSteps", () => {
  it("should step through every move in the order the server received it", () => {
    const moves = bothFinished();
    const shuffled = { ...moves, moves: [...moves.moves].reverse() };
    const steps = buildReviewSteps(shuffled);
    expect(steps).toHaveLength(20);
    expect(steps.map((s) => s.index)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(steps[4].slot).toBe("player_b");
    expect(steps[5].slot).toBe("player_b");
  });

  it("should count a player's moves and number each one", () => {
    const steps = buildReviewSteps(bothFinished());
    expect(steps[6].movesPlayed).toEqual({ a: 3, b: 4 });
    expect(steps[6].moveNumber).toBe(3);
    expect(last(steps).movesPlayed).toEqual({ a: 10, b: 10 });
  });

  it("should show a refused move as a step that changes nothing", () => {
    const rows = rowsFrom([
      { slot: "player_a", at: 10, points: 14, freezes: 3 },
      { slot: "player_b", at: 20, refused: true },
      { slot: "player_b", at: 25, points: 11, freezes: 3 },
    ]);
    const steps = buildReviewSteps(movesResponse(rows, "forfeit", last(rows).scoreAfter));
    expect(steps[1].kind).toBe("refused");
    expect(steps[1].board).toEqual(steps[0].board);
    expect(steps[1].points).toBe(0);
    expect(steps[1].movesPlayed).toEqual({ a: 1, b: 0 });
    expect(steps[1].moveNumber).toBe(1);
    expect(steps[2].moveNumber).toBe(1);
  });

  it("should give each step its points, the letters it froze and its swap", () => {
    const steps = buildReviewSteps(bothFinished());
    expect(steps[0].points).toBe(10);
    expect(steps[0].frozeCount).toBe(3);
    expect(steps[3].points).toBe(-5);
    expect(steps[3].words).toEqual([]);
    expect(steps[3].frozeCount).toBe(0);
    expect(steps[0].swap).toEqual({ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } });
  });

  it("should read the clock as it stood when each move was received", () => {
    const steps = buildReviewSteps(bothFinished());
    expect(steps[0].clockMs).toBe(290_000);
    const late = movesResponse(rowsFrom([{ slot: "player_a", at: 305, points: 10 }]), "moves_complete", { a: 10, b: 0 });
    expect(buildReviewSteps(late)[0].clockMs).toBe(0);
  });

  it("should close with the unplayed moves when the clock ended the match", () => {
    const steps = buildReviewSteps(birnaShort());
    const closing = last(steps);
    expect(closing.kind).toBe("closing");
    expect(closing.slot).toBeNull();
    expect(closing.clockMs).toBe(0);
    expect(closing.closing).toEqual({ reason: "time", unplayed: { a: 2, b: 0 }, penalty: { a: -10, b: 0 } });
    expect(closing.board).toEqual(steps[steps.length - 2].board);
  });

  it("should close an ended-early match with the absent player's unplayed moves", () => {
    const rows = rowsFrom(Array.from({ length: 15 }, (_, i) => ({ slot: (i < 10 ? (i % 2 ? "player_b" : "player_a") : "player_a") as "player_a" | "player_b", at: 5 + i * 10, points: 12 })));
    const tail = last(rows).scoreAfter;
    const moves = movesResponse(rows, "ended_early", { a: tail.a, b: tail.b + timeoutPenalty(tail.b, 5) }, Date.parse("2026-09-24T12:03:00.000Z"));
    const closing = last(buildReviewSteps(moves));
    expect(closing.closing?.reason).toBe("ended_early");
    expect(closing.closing?.unplayed).toEqual({ a: 0, b: 5 });
    expect(closing.clockMs).toBe(120_000);
  });

  it("should add no closing step when both finished or someone resigned", () => {
    expect(last(buildReviewSteps(bothFinished())).kind).toBe("move");
    const rows = rowsFrom([{ slot: "player_a", at: 10, points: 12 }, { slot: "player_b", at: 20, points: 14 }]);
    expect(last(buildReviewSteps(movesResponse(rows, "forfeit", last(rows).scoreAfter))).kind).toBe("move");
  });

  it("should review a match nobody played as its closing step alone", () => {
    const steps = buildReviewSteps(movesResponse([], "both_incomplete", { a: 0, b: 0 }));
    expect(steps).toHaveLength(1);
    expect(steps[0].closing?.unplayed).toEqual({ a: 10, b: 10 });
    expect(steps[0].board[0][0]).toBe("0");
  });

  it.each([
    ["both finished", bothFinished],
    ["one short at 0:00", birnaShort],
  ])("should end on the recorded result (%s)", (_name, make) => {
    const moves = make();
    const steps = buildReviewSteps(moves);
    expect(last(steps).totals).toEqual(moves.finalScores);
    expect(last(steps).board).toEqual(moves.moves.length ? last(moves.moves).boardAfter : moves.initialBoard);
  });
});
