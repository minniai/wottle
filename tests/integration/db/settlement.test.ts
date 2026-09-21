/**
 * Settlement (spec 050 FR-008…FR-011, contracts/settlement.md), T026.
 *
 * `settleMatchIfDue` drains the queue, then completes once both players have
 * ten moves or the database says the clock has run out; the completion is a
 * compare-and-set, so a second settlement finds the match already done.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/match/movePublisher", () => ({ publishMoveResolved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/game-engine/dictionary", () => ({ loadDictionary: vi.fn().mockResolvedValue(new Set()) }));

import { settleMatchIfDue } from "@/lib/match/matchSettlement";

import { connectTestDb, createTestMatch, dropTestMatch, insertPendingMoves, readMatch, readMoves, type TestMatch } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("settleMatchIfDue (T026)", () => {
  let match: TestMatch;

  afterEach(async () => {
    if (match) await dropTestMatch(db!, match);
  });

  it("is not due while the clock runs and a player is short of ten", async () => {
    match = await createTestMatch(db!, { moves: { a: 10, b: 9 } });
    expect(await settleMatchIfDue(match.matchId)).toBe("not_due");
    expect((await readMatch(db!, match.matchId)).state).toBe("in_progress");
  });

  it("completes early once both have ten: score decides, moves_complete", async () => {
    match = await createTestMatch(db!, { moves: { a: 10, b: 10 } });
    await db!.client.from("matches").update({ player_a_score: 40, player_b_score: 55 }).eq("id", match.matchId);
    expect(await settleMatchIfDue(match.matchId)).toBe("completed");
    const row = await readMatch(db!, match.matchId);
    expect(row).toMatchObject({ state: "completed", winner_id: match.playerBId, ended_reason: "moves_complete" });
    const { data: ratings } = await db!.client.from("match_ratings").select("player_id").eq("match_id", match.matchId);
    expect(ratings).toHaveLength(2);
  });

  it("at 0:00 a player short of ten loses whatever the totals; the second settlement is `already`", async () => {
    match = await createTestMatch(db!, { moves: { a: 8, b: 10 }, deadlineInMs: -5000 });
    await db!.client.from("matches").update({ player_a_score: 90, player_b_score: 20 }).eq("id", match.matchId);
    expect(await settleMatchIfDue(match.matchId)).toBe("completed");
    expect(await settleMatchIfDue(match.matchId)).toBe("already");
    const row = await readMatch(db!, match.matchId);
    expect(row).toMatchObject({ state: "completed", winner_id: match.playerBId, ended_reason: "incomplete" });
    const { data: ratings } = await db!.client.from("match_ratings").select("player_id").eq("match_id", match.matchId);
    expect(ratings).toHaveLength(2);
  });

  it("both short of ten at 0:00 is a draw, both_incomplete", async () => {
    match = await createTestMatch(db!, { moves: { a: 7, b: 9 }, deadlineInMs: -5000 });
    expect(await settleMatchIfDue(match.matchId)).toBe("completed");
    expect(await readMatch(db!, match.matchId)).toMatchObject({ winner_id: null, ended_reason: "both_incomplete" });
  });

  it("drains moves received before the deadline before deciding", async () => {
    match = await createTestMatch(db!, { moves: { a: 9, b: 10 }, deadlineInMs: -5000 });
    await insertPendingMoves(db!, match, 1); // A's tenth, received in the last second
    expect(await settleMatchIfDue(match.matchId)).toBe("completed");
    const row = await readMatch(db!, match.matchId);
    expect(row.player_a_moves).toBe(10);
    expect(row.ended_reason).toBe("moves_complete");
    expect((await readMoves(db!, match.matchId))[0].status).toBe("resolved");
  });

  it("racing settlements rate the match once", async () => {
    match = await createTestMatch(db!, { moves: { a: 10, b: 10 } });
    const outcomes = await Promise.all([settleMatchIfDue(match.matchId), settleMatchIfDue(match.matchId), settleMatchIfDue(match.matchId)]);
    expect(outcomes.filter((o) => o === "completed")).toHaveLength(1);
    const { data: ratings } = await db!.client.from("match_ratings").select("player_id").eq("match_id", match.matchId);
    expect(ratings).toHaveLength(2);
  });
});
