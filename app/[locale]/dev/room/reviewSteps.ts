import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import type { AccumulatedWord } from "@/lib/room/ledgerRows";
import type { FrozenTileMap } from "@/lib/types/match";
import type { MovesResponse, ReviewMoveRow, ReviewStep } from "@/lib/types/review";

import { FIXTURE_BOARD, FIXTURE_WORDS, OPP_ID, YOU_ID } from "./fixtures";

/**
 * Spec 071 (T058, artboard Review): Match E as static review steps. Twenty steps, both play ten;
 * steps 5 and 6 are two Kári moves back to back (receipt order at work); step 7 is Birna's move 3,
 * LEK. The board is the fixture's throughout, so every band lies on its letters.
 */
const ORDER: ("a" | "b")[] = ["a", "b", "a", "b", "b", "b", "a", "a", "b", "a", "b", "a", "b", "a", "b", "a", "b", "a", "b", "a"];
const STARTED = Date.parse("2026-09-15T09:55:00.000Z");

export type ReviewVariant = "both" | "refused" | "time";

function wordsOf(playerId: string, move: number): AccumulatedWord[] {
  return FIXTURE_WORDS.filter((w) => w.playerId === playerId && w.moveSeq === move);
}

function rowsFor(variant: ReviewVariant): ReviewMoveRow[] {
  const order = variant === "time" ? ORDER.slice(0, 16) : ORDER;
  const counts = { a: 0, b: 0 };
  const totals = { a: 0, b: 0 };
  let frozen: FrozenTileMap = {};
  return order.map((side, i) => {
    const refused = variant === "refused" && i === 8;
    const playerId = side === "a" ? YOU_ID : OPP_ID;
    if (!refused) counts[side] += 1;
    const words = refused ? [] : wordsOf(playerId, counts[side]);
    const points = words.length ? words.reduce((sum, w) => sum + w.totalPoints, 0) : refused ? 0 : -Math.min(5, totals[side]);
    totals[side] += points;
    for (const w of words) for (const c of w.coordinates) frozen = { [`${c.x},${c.y}`]: { owner: side === "a" ? "player_a" : "player_b" }, ...frozen };
    return {
      globalSeq: i + 1,
      slot: side === "a" ? "player_a" : "player_b",
      seq: refused ? null : counts[side],
      status: refused ? "rejected" : "resolved",
      rejectionReason: refused ? "frozen" : null,
      swap: { from: { x: i % 10, y: 1 }, to: { x: i % 10, y: 2 } },
      receivedAt: new Date(STARTED + 9_000 + i * 13_000).toISOString(),
      boardAfter: FIXTURE_BOARD,
      frozenAfter: { ...frozen },
      scoreAfter: { ...totals },
      delta: points,
      words: words.map(({ playerId: p, word, totalPoints, coordinates, direction }) => ({ playerId: p, word, length: word.length, lettersPoints: totalPoints - 5, bonusPoints: 5, totalPoints, coordinates, direction })),
    } satisfies ReviewMoveRow;
  });
}

export function reviewFixtureSteps(variant: ReviewVariant = "both"): ReviewStep[] {
  const moves = rowsFor(variant);
  const last = moves[moves.length - 1].scoreAfter;
  const counts = { a: moves.filter((m) => m.slot === "player_a" && m.status === "resolved").length, b: moves.filter((m) => m.slot === "player_b" && m.status === "resolved").length };
  const penalty = (total: number, n: number) => -Math.min(total, 5 * (10 - n));
  const finalScores = variant === "time" ? { a: last.a + penalty(last.a, counts.a), b: last.b + penalty(last.b, counts.b) } : last;
  const response: MovesResponse = {
    matchId: "fixture-match",
    language: "is",
    players: { a: { id: YOU_ID, displayName: "Birna" }, b: { id: OPP_ID, displayName: "Kári" } },
    startedAt: new Date(STARTED).toISOString(),
    durationMs: 300_000,
    moveLimit: 10,
    endedReason: variant === "time" ? "both_incomplete" : "moves_complete",
    completedAt: new Date(STARTED + 292_000).toISOString(),
    winnerId: YOU_ID,
    finalScores,
    initialBoard: FIXTURE_BOARD,
    moves,
  };
  return buildReviewSteps(response);
}
