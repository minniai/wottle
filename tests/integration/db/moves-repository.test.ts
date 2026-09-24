/**
 * Spec 071 (T011): the review read against a live database, so the embedded word rows and the
 * column names are real. Skips without Supabase.
 */
import { afterEach, describe, expect, it } from "vitest";

import { loadCompletedMoves } from "@/lib/review/movesRepository";

import { claim, connectTestDb, createTestMatch, dropTestMatch, finishRejected, receive, type TestMatch } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("loadCompletedMoves (spec 071)", () => {
  let match: TestMatch | null = null;
  afterEach(async () => {
    if (match) await dropTestMatch(db!, match);
    match = null;
  });

  it("reads a completed match's finished moves, and nothing while it is live", async () => {
    match = await createTestMatch(db!);
    await receive(db!, match, match.playerAId);
    const claimed = await claim(db!, match.matchId);
    await finishRejected(db!, claimed!);
    expect(await loadCompletedMoves(db!.client as never, match.matchId)).toBeNull();

    await db!.client.from("matches").update({ state: "completed", ended_reason: "forfeit", completed_at: new Date().toISOString() }).eq("id", match.matchId);
    const moves = await loadCompletedMoves(db!.client as never, match.matchId);
    expect(moves?.players.a.displayName).toBe("Anna");
    expect(moves?.moves).toHaveLength(1);
    expect(moves?.moves[0]).toMatchObject({ globalSeq: 1, slot: "player_a", status: "rejected", words: [] });
    expect(moves?.durationMs).toBeGreaterThan(0);
  });
});
