/**
 * A stuck claim is reclaimed and a zombie finish writes nothing
 * (spec 050 FR-012, contracts/move-resolver.md), T026.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { claim, connectTestDb, createTestMatch, dropTestMatch, finishRejected, insertPendingMoves, readMatch, readMoves, type TestMatch } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("stuck move recovery (T026)", () => {
  let match: TestMatch;

  beforeEach(async () => {
    match = await createTestMatch(db!);
    await insertPendingMoves(db!, match, 2);
  });
  afterEach(async () => {
    await dropTestMatch(db!, match);
  });

  it("a fresh claim is exclusive; a stale one is handed out again with claim_count 2", async () => {
    const first = await claim(db!, match.matchId);
    expect(first?.move).toMatchObject({ global_seq: 1, claim_count: 1, status: "resolving" });
    expect(await claim(db!, match.matchId)).toBeNull();
    const reclaimed = await claim(db!, match.matchId, 0);
    expect(reclaimed?.move).toMatchObject({ id: first!.move.id, global_seq: 1, claim_count: 2 });
  });

  it("the first finish wins; the other writes zero rows and the cursor moves once", async () => {
    const zombie = (await claim(db!, match.matchId))!;
    const reclaimer = (await claim(db!, match.matchId, 0))!;
    expect(reclaimer.move.id).toBe(zombie.move.id);

    expect(await finishRejected(db!, zombie)).toMatchObject({ written: 1 });
    expect(await finishRejected(db!, reclaimer)).toMatchObject({ written: 0 });

    expect((await readMatch(db!, match.matchId)).resolved_seq).toBe(1);
    const rows = await readMoves(db!, match.matchId);
    expect(rows[0]).toMatchObject({ status: "rejected" });
    expect(rows[1]).toMatchObject({ status: "pending" });
    expect((await claim(db!, match.matchId))?.move.global_seq).toBe(2);
  });

  it("nothing is claimable once the match is no longer in progress", async () => {
    await db!.client.from("matches").update({ state: "completed" }).eq("id", match.matchId);
    expect(await claim(db!, match.matchId)).toBeNull();
  });
});
