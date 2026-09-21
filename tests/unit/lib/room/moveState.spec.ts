import { describe, expect, it } from "vitest";

import { barSuffixFor, barToneFor, deriveMoveState, liveLinesFor, turnFrameFor, type MoveState } from "@/lib/room/moveState";
import type { MatchState, MoveResolution, PlayerMatchFacts } from "@/lib/types/match";

/** Spec 050 contracts/move-state.md. */
const K = "Kári";
const YOU = "you";
const OPP = "opp";

function facts(playerId: string, over: Partial<PlayerMatchFacts> = {}): PlayerMatchFacts {
  return { playerId, movesPlayed: 3, score: 46, inFlight: null, lastResolution: null, ...over };
}

function match(you: Partial<PlayerMatchFacts> = {}, opp: Partial<PlayerMatchFacts> = {}, over: Partial<MatchState> = {}): MatchState {
  return {
    matchId: "m1",
    board: [],
    state: "in_progress",
    players: { playerA: facts(YOU, you), playerB: facts(OPP, { movesPlayed: 6, score: 15, ...opp }) },
    clock: { startedAt: "2026-09-15T09:55:00.000Z", deadlineAt: "2026-09-15T10:00:00.000Z", serverNow: "2026-09-15T09:56:48.000Z" },
    moveLimit: 10,
    resolvedSeq: 9,
    scores: { playerA: 46, playerB: 15 },
    frozenTiles: {},
    ...over,
  };
}

const resolution = (delta: number): MoveResolution => ({
  matchId: "m1", moveId: "mv", playerId: YOU, globalSeq: 10, seq: 4, status: "resolved",
  swap: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, board: [], words: [], delta,
  totals: { playerA: 59, playerB: 15 }, frozenTiles: {}, movesPlayed: { playerA: 4, playerB: 6 }, resolvedAt: "",
});

const derive = (m: MatchState, extra: Partial<Parameters<typeof deriveMoveState>[0]> = {}) =>
  deriveMoveState({ match: m, viewerSlot: "player_a", opponentName: K, holdMove: null, revealingOwn: false, rejected: null, clockMs: 192_000, ...extra });

describe("deriveMoveState", () => {
  it("your move when nothing is in flight: the next move is movesPlayed + 1", () => {
    expect(derive(match())).toEqual({ kind: "yourMove", move: 4, opponentName: K });
  });
  it("scoring while your move is in flight or its reveal is drawing", () => {
    expect(derive(match({ inFlight: { moveId: "mv", globalSeq: 10, receivedAt: "" } }))).toMatchObject({ kind: "scoring", move: 4 });
    expect(derive(match(), { revealingOwn: true })).toMatchObject({ kind: "scoring", move: 4 });
  });
  it("scored during the hold, with the delta of your last resolution and the next move", () => {
    expect(derive(match({ movesPlayed: 4, lastResolution: resolution(13) }), { holdMove: 4 })).toEqual({ kind: "scored", move: 4, delta: 13, next: 5, opponentName: K });
  });
  it("rejected for the notice window, then your move again", () => {
    expect(derive(match(), { rejected: "frozen" })).toEqual({ kind: "rejected", move: 4, reason: "frozen", opponentName: K });
  });
  it("done once you have the move limit, with the opponent's count and the clock", () => {
    expect(derive(match({ movesPlayed: 10 }, { movesPlayed: 8 }), { clockMs: 48_000 })).toEqual({ kind: "done", opponentName: K, opponentMoves: 8, clockMmSs: "0:48" });
  });
  it("the hold outranks done: the tenth move is held before the waiting beat opens", () => {
    expect(derive(match({ movesPlayed: 10, lastResolution: resolution(5) }), { holdMove: 10 })).toMatchObject({ kind: "scored", move: 10 });
  });
  it("time up when the clock is spent and the match is still in progress", () => {
    expect(derive(match(), { clockMs: 0 })).toEqual({ kind: "timeUp", opponentName: K });
  });
  it("the opponent's moves never change the viewer's beat", () => {
    expect(derive(match({}, { inFlight: { moveId: "x", globalSeq: 11, receivedAt: "" }, movesPlayed: 9 }))).toMatchObject({ kind: "yourMove", move: 4 });
  });
  it("seat-relative: player B reads its own facts", () => {
    const m = match({ movesPlayed: 10 }, { movesPlayed: 2 });
    expect(deriveMoveState({ match: m, viewerSlot: "player_b", opponentName: "Birna", holdMove: null, revealingOwn: false, rejected: null, clockMs: 100_000 })).toMatchObject({ kind: "yourMove", move: 3 });
  });
});

describe("liveLinesFor", () => {
  const yourMove: MoveState = { kind: "yourMove", move: 4, opponentName: K };
  it("your move: the beat over the field's instruction", () => {
    expect(liveLinesFor(yourMove, { kind: "idle" })).toEqual({ line1: "move 4 · your move", line2: "pick a letter" });
    expect(liveLinesFor(yourMove, { kind: "picking", letter: "T", value: 2 })).toEqual({ line1: "move 4 · your move", line2: "picking · T (2) · tap a second letter" });
  });
  it("rejected: the beat over the reason and the next step", () => {
    expect(liveLinesFor({ kind: "rejected", move: 5, opponentName: K, reason: "frozen" }, { kind: "idle" })).toEqual({ line1: "move 5 · your move", line2: "frozen · Kári just froze it · pick another" });
    expect(liveLinesFor({ kind: "rejected", move: 5, opponentName: K, reason: "moved" }, { kind: "idle" }).line2).toBe("moved · Kári just moved it · pick another");
  });
  it("scoring collapses to one line; scored says the delta and the next move", () => {
    expect(liveLinesFor({ kind: "scoring", move: 4, opponentName: K }, { kind: "played" })).toEqual({ line1: "move 4 · scoring", line2: "" });
    expect(liveLinesFor({ kind: "scored", move: 4, opponentName: K, delta: 13, next: 5 }, { kind: "idle" })).toEqual({ line1: "move 4 scored", line2: "you +13 · move 5 opens" });
  });
  it("done and time up", () => {
    expect(liveLinesFor({ kind: "done", opponentName: K, opponentMoves: 8, clockMmSs: "1:12" }, { kind: "idle" })).toEqual({ line1: "10 of 10 played", line2: "waiting for Kári · 8 of 10 · 1:12 left" });
    expect(liveLinesFor({ kind: "timeUp", opponentName: K }, { kind: "idle" })).toEqual({ line1: "time · scoring", line2: "" });
  });
});

describe("bar suffixes and the turn frame", () => {
  const counts = { you: 3, opp: 6, oppScoring: false, limit: 10 };
  it("your count in your bar, in the seat colour only while a move is yours to make", () => {
    const yourMove: MoveState = { kind: "yourMove", move: 4, opponentName: K };
    expect(barSuffixFor(yourMove, "you", counts)).toBe("move 4 of 10");
    expect(barToneFor(yourMove)).toBe("seat");
    expect(barSuffixFor({ kind: "scoring", move: 4, opponentName: K }, "you", counts)).toBe("move 4 of 10 · scoring");
    expect(barToneFor({ kind: "scoring", move: 4, opponentName: K })).toBe("muted");
    expect(barSuffixFor({ kind: "done", opponentName: K, opponentMoves: 8, clockMmSs: "1:12" }, "you", { ...counts, you: 10 })).toBe("10 of 10 · done");
    expect(barSuffixFor({ kind: "timeUp", opponentName: K }, "you", counts)).toBeNull();
  });
  it("their count in their bar: playing, scoring or done", () => {
    const yourMove: MoveState = { kind: "yourMove", move: 4, opponentName: K };
    expect(barSuffixFor(yourMove, "opp", counts)).toBe("6 of 10 · playing");
    expect(barSuffixFor(yourMove, "opp", { ...counts, oppScoring: true })).toBe("6 of 10 · scoring");
    expect(barSuffixFor(yourMove, "opp", { ...counts, opp: 10 })).toBe("10 of 10 · done");
  });
  it("the field is framed only while a move is yours to make", () => {
    expect(turnFrameFor({ kind: "yourMove", move: 4, opponentName: K })).toBe("you");
    expect(turnFrameFor({ kind: "rejected", move: 4, opponentName: K, reason: "moved" })).toBe("you");
    expect(turnFrameFor({ kind: "scoring", move: 4, opponentName: K })).toBeNull();
    expect(turnFrameFor({ kind: "done", opponentName: K, opponentMoves: 8, clockMmSs: "1:12" })).toBeNull();
  });
});

describe("the start countdown (spec 050 FR-008, contracts/match-state.md)", () => {
  it("before started_at the beat is `starts in N`, counted up from the server anchor", () => {
    const state = derive(match({ movesPlayed: 0 }, { movesPlayed: 0 }), { msToStart: 2_100 });
    expect(state).toEqual({ kind: "starting", seconds: 3, opponentName: K });
    expect(liveLinesFor(state, { kind: "idle" })).toEqual({ line1: "starts in 3", line2: "" });
  });

  it("nothing is the viewer's to make while it counts: no frame, a muted suffix", () => {
    const state: MoveState = { kind: "starting", seconds: 1, opponentName: K };
    expect(turnFrameFor(state)).toBeNull();
    expect(barToneFor(state)).toBe("muted");
    expect(barSuffixFor(state, "you", { you: 0, opp: 0, oppScoring: false, limit: 10 })).toBe("move 1 of 10");
  });

  it("at the start the first move opens", () => {
    expect(derive(match({ movesPlayed: 0 }), { msToStart: 0 })).toEqual({ kind: "yourMove", move: 1, opponentName: K });
  });
});

