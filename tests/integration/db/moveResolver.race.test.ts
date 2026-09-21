/**
 * Two resolvers over one queue (spec 050 FR-004, FR-012, contracts/move-resolver.md), T026.
 *
 * One pending move per player and `resolvePendingMoves` run twice at once:
 * each move is finished exactly once. Five moves over two players resolve in
 * receipt order with their per-player numbers, and a scoring move writes its
 * words, count and total through `finish_move`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/match/movePublisher", () => ({ publishMoveResolved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/match/statePublisher", () => ({ publishMatchState: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/game-engine/dictionary", () => ({ loadDictionary: vi.fn().mockResolvedValue(new Set(["hestur"])) }));
vi.mock("@/lib/match/integrityCheck", () => ({ checkMoveIntegrity: vi.fn().mockResolvedValue([]) }));

import { checkMoveIntegrity } from "@/lib/match/integrityCheck";
import { publishMoveResolved } from "@/lib/match/movePublisher";
import { resolvePendingMoves } from "@/lib/match/moveResolver";

import { blankBoard, connectTestDb, createTestMatch, dropTestMatch, insertPendingMoves, readMatch, readMoves, receive, type TestMatch } from "./harness";

const db = await connectTestDb();

describe.skipIf(!db)("resolvePendingMoves under contention (T026)", () => {
  let match: TestMatch;

  beforeEach(() => {
    vi.mocked(publishMoveResolved).mockClear();
    vi.mocked(checkMoveIntegrity).mockClear();
  });
  afterEach(async () => {
    if (match) await dropTestMatch(db!, match);
  });

  it("two resolvers over one queue finish each pending move exactly once", async () => {
    match = await createTestMatch(db!);
    await insertPendingMoves(db!, match, 2);

    const [left, right] = await Promise.all([resolvePendingMoves(match.matchId), resolvePendingMoves(match.matchId)]);

    expect(left.resolved + right.resolved).toBe(2);
    const row = await readMatch(db!, match.matchId);
    expect(row).toMatchObject({ resolved_seq: 2, player_a_moves: 1, player_b_moves: 1 });
    const moves = await readMoves(db!, match.matchId);
    expect(moves.map((m) => m.status)).toEqual(["resolved", "resolved"]);
    expect(moves.map((m) => m.claim_count)).toEqual([1, 1]);
    expect(publishMoveResolved).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publishMoveResolved).mock.calls.map(([r]) => r.globalSeq)).toEqual([1, 2]);
  });

  it("five moves over two players resolve in receipt order with their own numbers", async () => {
    match = await createTestMatch(db!);
    const order = [match.playerAId, match.playerBId, match.playerAId, match.playerBId, match.playerAId];
    for (let i = 0; i < order.length; i += 1) {
      expect((await receive(db!, match, order[i], { x: i, y: 5, tx: i, ty: 6 })).status).toBe("accepted");
      if (i % 2 === 1 || i === order.length - 1) await resolvePendingMoves(match.matchId);
    }

    const row = await readMatch(db!, match.matchId);
    expect(row).toMatchObject({ resolved_seq: 5, move_seq: 5, player_a_moves: 3, player_b_moves: 2 });
    const moves = await readMoves(db!, match.matchId);
    expect(moves.map((m) => m.player_id)).toEqual(order);
    expect(moves.map((m) => m.seq)).toEqual([1, 1, 2, 2, 3]);
    expect(vi.mocked(publishMoveResolved).mock.calls.map(([r]) => [r.globalSeq, r.seq])).toEqual([[1, 1], [2, 1], [3, 2], [4, 2], [5, 3]]);
  });

  it("a scoring move writes its word, its count and its total through finish_move", async () => {
    const board = blankBoard();
    ["h", "e", "s", "t", "u"].forEach((ch, i) => (board[0][i] = ch));
    board[1][5] = "r";
    match = await createTestMatch(db!, { board });
    const receipt = await receive(db!, match, match.playerAId, { x: 5, y: 0, tx: 5, ty: 1, to: "r" });
    expect(receipt.status).toBe("accepted");

    const { resolved } = await resolvePendingMoves(match.matchId);

    expect(resolved).toBe(1);
    const row = await readMatch(db!, match.matchId);
    expect(row.player_a_moves).toBe(1);
    expect(row.player_a_score).toBeGreaterThan(0);
    expect((row.board as string[][])[0].slice(0, 6).join("")).toBe("hestur");
    expect(Object.keys(row.frozen_tiles as Record<string, unknown>)).toHaveLength(6);
    const { data: words } = await db!.client.from("word_score_entries").select("word, total_points, move_id").eq("match_id", match.matchId);
    expect(words).toEqual([{ word: "hestur", total_points: row.player_a_score, move_id: receipt.moveId }]);
    const [move] = await readMoves(db!, match.matchId);
    expect(move).toMatchObject({ status: "resolved", seq: 1, delta: row.player_a_score, score_a_after: row.player_a_score });
    // Spec 049 FR-002, per move since spec 050: the board just written is checked.
    expect(checkMoveIntegrity).toHaveBeenCalledTimes(1);
    expect(vi.mocked(checkMoveIntegrity).mock.calls[0][1]).toMatchObject({ matchId: match.matchId, globalSeq: 1, board: row.board });
  });

  it("a move onto a letter an earlier move froze is refused and not counted", async () => {
    const board = blankBoard();
    ["h", "e", "s", "t", "u"].forEach((ch, i) => (board[0][i] = ch));
    board[1][5] = "r";
    match = await createTestMatch(db!, { board });
    await receive(db!, match, match.playerAId, { x: 5, y: 0, tx: 5, ty: 1, to: "r" });
    // B's move touches (0,0), the h that A's word will freeze; it was received second.
    const b = await receive(db!, match, match.playerBId, { x: 0, y: 0, tx: 0, ty: 1, from: "h" });
    expect(b.status).toBe("accepted");

    await resolvePendingMoves(match.matchId);

    const row = await readMatch(db!, match.matchId);
    expect(row.player_b_moves).toBe(0);
    expect(row.resolved_seq).toBe(2);
    const [, refused] = await readMoves(db!, match.matchId);
    expect(refused).toMatchObject({ status: "rejected", rejection_reason: "frozen", seq: null, delta: 0 });
    // A refusal changes nothing on the board, so only the scoring move is checked.
    expect(checkMoveIntegrity).toHaveBeenCalledTimes(1);
  });

  it("every miss costs a flat −5 (rules §5.6)", async () => {
    match = await createTestMatch(db!);
    for (let i = 0; i < 2; i += 1) {
      expect((await receive(db!, match, match.playerAId, { x: i, y: 5, tx: i, ty: 6 })).status).toBe("accepted");
      await resolvePendingMoves(match.matchId);
    }
    const moves = await readMoves(db!, match.matchId);
    expect(moves.map((m) => m.delta)).toEqual([-5, -5]);
    expect(await readMatch(db!, match.matchId)).toMatchObject({ player_a_moves: 2, player_a_score: -10 });
  });
});

