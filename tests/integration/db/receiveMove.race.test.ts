/**
 * Receipt order (spec 050 FR-003, FR-004, contracts/receive-move.md), T026.
 *
 * Both players fire at once, many times over. Every accepted move gets the
 * next gap-free `global_seq`, `received_at` never runs backwards against it,
 * and a player's second call while their first is still in flight is refused
 * without a row.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connectTestDb, createTestMatch, drainRejecting, dropTestMatch, readMoves, receive, type TestMatch } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("receive_move under contention (T026)", () => {
  let match: TestMatch;

  beforeAll(async () => {
    match = await createTestMatch(db!);
  });
  afterAll(async () => {
    if (match) await dropTestMatch(db!, match);
  });

  it("stamps a gap-free global_seq in receipt order and refuses the second in-flight move", async () => {
    const ROUNDS = 25;
    const accepted: Array<{ globalSeq: number; receivedAt: string }> = [];
    let inFlightRefusals = 0;

    for (let i = 0; i < ROUNDS; i += 1) {
      // Three calls at once: A, B, and A again. Exactly one A call may land.
      const receipts = await Promise.all([
        receive(db!, match, match.playerAId),
        receive(db!, match, match.playerBId),
        receive(db!, match, match.playerAId),
      ]);
      const landed = receipts.filter((r) => r.status === "accepted");
      expect(landed).toHaveLength(2);
      expect(receipts.filter((r) => r.reason === "in_flight")).toHaveLength(1);
      inFlightRefusals += 1;
      for (const r of landed) accepted.push({ globalSeq: r.globalSeq!, receivedAt: r.receivedAt! });
      expect(await drainRejecting(db!, match.matchId)).toBe(2);
    }

    accepted.sort((p, q) => p.globalSeq - q.globalSeq);
    expect(accepted.map((r) => r.globalSeq)).toEqual(Array.from({ length: ROUNDS * 2 }, (_, i) => i + 1));
    for (let i = 1; i < accepted.length; i += 1) {
      expect(Date.parse(accepted[i].receivedAt)).toBeGreaterThanOrEqual(Date.parse(accepted[i - 1].receivedAt));
    }
    expect(inFlightRefusals).toBe(ROUNDS);

    const rows = await readMoves(db!, match.matchId);
    expect(rows).toHaveLength(ROUNDS * 2);
    expect(rows.every((r) => r.status === "rejected")).toBe(true);
  });

  it("refuses at the cap without a row, and the refusal does not consume a move", async () => {
    const capped = await createTestMatch(db!, { moves: { a: 10, b: 3 } });
    try {
      expect(await receive(db!, capped, capped.playerAId)).toMatchObject({ status: "rejected", reason: "cap" });
      const b = await receive(db!, capped, capped.playerBId);
      expect(b.status).toBe("accepted");
      expect(await drainRejecting(db!, capped.matchId)).toBe(1);
      const rows = await readMoves(db!, capped.matchId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: "rejected", rejection_reason: "moved", seq: null });
      const { data } = await db!.client.from("matches").select("player_b_moves, resolved_seq").eq("id", capped.matchId).single();
      expect(data).toEqual({ player_b_moves: 3, resolved_seq: 1 });
    } finally {
      await dropTestMatch(db!, capped);
    }
  });

  it("refuses after the deadline and before the start", async () => {
    const late = await createTestMatch(db!, { deadlineInMs: -5000 });
    const early = await createTestMatch(db!, { state: "pending" });
    try {
      expect(await receive(db!, late, late.playerAId)).toMatchObject({ status: "rejected", reason: "deadline" });
      expect(await receive(db!, early, early.playerAId)).toMatchObject({ status: "rejected", reason: "ended" });
      expect(await readMoves(db!, late.matchId)).toHaveLength(0);
    } finally {
      await dropTestMatch(db!, late);
      await dropTestMatch(db!, early);
    }
  });
});
