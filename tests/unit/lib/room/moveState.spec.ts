import { describe, expect, it } from "vitest";
import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";

import { deriveMoveState, liveLinesFor, turnFrameFor, type MoveState } from "@/lib/room/moveState";
import type { MatchState, MoveResolution, PlayerMatchFacts } from "@/lib/types/match";
import { SEATED_TABLE } from "@/lib/match/table";

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
    language: "is",
    resolvedSeq: 9,
    scores: { playerA: 46, playerB: 15 },
    frozenTiles: {},
    table: SEATED_TABLE,
    stakes: null,
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
    expect(liveLinesFor(yourMove, { kind: "idle" }, copyEn)).toEqual({ line1: "move 4 · your move", line2: "pick a letter" });
    expect(liveLinesFor(yourMove, { kind: "picking", letter: "T", value: 2 }, copyEn)).toEqual({ line1: "move 4 · your move", line2: "picking · T (2) · tap a second letter" });
  });
  it("rejected: the beat over the reason and the next step", () => {
    expect(liveLinesFor({ kind: "rejected", move: 5, opponentName: K, reason: "frozen" }, { kind: "idle" }, copyEn)).toEqual({ line1: "move 5 · your move", line2: "frozen · Kári froze it · pick another" });
    expect(liveLinesFor({ kind: "rejected", move: 5, opponentName: K, reason: "moved" }, { kind: "idle" }, copyEn).line2).toBe("moved · Kári moved it · pick another");
  });
  it("scoring collapses to one line; scored says the delta and the next move", () => {
    expect(liveLinesFor({ kind: "scoring", move: 4, opponentName: K }, { kind: "played" }, copyEn)).toEqual({ line1: "move 4 · scoring", line2: "" });
    expect(liveLinesFor({ kind: "scored", move: 4, opponentName: K, delta: 13, next: 5 }, { kind: "idle" }, copyEn)).toEqual({ line1: "move 4 scored", line2: "you +13 · move 5 opens" });
  });
  it("done and time up", () => {
    expect(liveLinesFor({ kind: "done", opponentName: K, opponentMoves: 8, clockMmSs: "1:12" }, { kind: "idle" }, copyEn)).toEqual({ line1: "10 of 10 played", line2: "Kári · 8 of 10 · 1:12 left" });
    expect(liveLinesFor({ kind: "timeUp", opponentName: K }, { kind: "idle" }, copyEn)).toEqual({ line1: "time · scoring", line2: "" });
  });
});

describe("bar suffixes and the turn frame", () => {
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
    expect(liveLinesFor(state, { kind: "idle" }, copyEn)).toEqual({ line1: "starts in 3", line2: "" });
  });

  it("nothing is the viewer's to make while it counts: no frame, a muted suffix", () => {
    const state: MoveState = { kind: "starting", seconds: 1, opponentName: K };
    expect(turnFrameFor(state)).toBeNull();
  });

  it("at the start the first move opens", () => {
    expect(derive(match({ movesPlayed: 0 }), { msToStart: 0 })).toEqual({ kind: "yourMove", move: 1, opponentName: K });
  });
});


describe("the live row's second line (spec 068 FR-028–FR-031)", () => {
  const idle = { kind: "idle" } as const;
  const yourMove: MoveState = { kind: "yourMove", move: 4, opponentName: K };

  it("a move with no word is the missed beat: `move 4 · no word`, then the loss and the next move", () => {
    const lines = liveLinesFor({ kind: "scored", move: 4, opponentName: K, delta: -5, next: 5, missed: true }, idle, copyEn);
    expect(lines.line1).toBe("move 4 · no word");
    expect(lines.line2).toBe("−5 · move 5 opens");
    expect(lines.line2Parts).toEqual([{ pointsLost: { value: -5 } }, { text: " · move 5 opens" }]);
  });

  it("a floored miss says why it cost less", () => {
    const lines = liveLinesFor({ kind: "scored", move: 4, opponentName: K, delta: -3, next: 5, missed: true }, idle, copyEn);
    expect(lines.line2).toBe("−3 · a total never falls below 0");
  });

  it("a scored move keeps its beat", () => {
    expect(liveLinesFor({ kind: "scored", move: 4, opponentName: K, delta: 13, next: 5, missed: false }, idle, copyEn)).toMatchObject({ line1: "move 4 scored", line2: "you +13 · move 5 opens" });
  });

  it("under a minute, with the move yours and nothing picked, line 2 is the stakes", () => {
    const lines = liveLinesFor(yourMove, idle, copyEn, { stakes: { movesLeft: 3, penalty: -15 } });
    expect(lines.line2).toBe("3 moves left · −15 if unplayed");
    expect(lines.line2Parts).toEqual([{ text: "3 moves left · " }, { pointsLost: { value: -15, label: "if unplayed" } }]);
    expect(liveLinesFor(yourMove, idle, copyEn, { stakes: { movesLeft: 3, penalty: 0 } }).line2).toBe("3 moves left · nothing to lose");
    expect(liveLinesFor(yourMove, idle, copyEn, { stakes: { movesLeft: 1, penalty: -5 } }).line2).toBe("1 move left · −5 if unplayed");
    // A pick in hand is the instruction's moment, not the stakes'.
    expect(liveLinesFor(yourMove, { kind: "picking", letter: "T", value: 2 }, copyEn, { stakes: { movesLeft: 3, penalty: -15 } }).line2).toBe("picking · T (2) · tap a second letter");
  });

  it("an illegal pick names the word and its owner", () => {
    expect(liveLinesFor(yourMove, { kind: "illegal", ownerName: K, round: 2, word: "GILT" }, copyEn).line2).toBe("frozen · GILT · Kári · pick another");
  });

  it("pick cleared, a submit error, the end-early offer, offline and back are all line 2, by precedence", () => {
    expect(liveLinesFor(yourMove, idle, copyEn, { pickClearedBy: K }).line2).toBe("pick cleared · Kári moved that letter");
    expect(liveLinesFor(yourMove, idle, copyEn, { submitError: "swap rejected", pickClearedBy: K }).line2).toBe("swap rejected");
    expect(liveLinesFor(yourMove, idle, copyEn, { offline: true, submitError: "swap rejected" }).line2).toBe("offline · reconnecting");
    expect(liveLinesFor(yourMove, idle, copyEn, { backAwayMs: 34_000 }).line2).toBe("back · away 0:34 · the clock ran on");
    const done: MoveState = { kind: "done", opponentName: K, opponentMoves: 8, clockMmSs: "1:12" };
    const offer = liveLinesFor(done, idle, copyEn, { endEarlyOffer: K });
    expect(offer.line1).toBe("10 of 10 played");
    expect(offer.line2).toBe("Kári is gone · end the match ▸");
    expect(offer.line2Parts).toEqual([{ text: "Kári is gone · " }, { action: { label: "end the match ▸", action: "endEarly" } }]);
  });

  it("in Icelandic", () => {
    expect(liveLinesFor({ kind: "scored", move: 4, opponentName: K, delta: -5, next: 5, missed: true }, idle, copyIs)).toMatchObject({ line1: "leikur 4 · ekkert orð", line2: "−5 · leikur 5 opnast" });
    expect(liveLinesFor(yourMove, idle, copyIs, { stakes: { movesLeft: 3, penalty: -15 } }).line2).toBe("3 leikir eftir · −15 ef óleiknir");
    expect(liveLinesFor(yourMove, { kind: "illegal", ownerName: K, round: 2, word: "GILT" }, copyIs).line2).toBe("frosinn · GILT · Kári · veldu annan");
  });
});

describe("deriveMoveState: a resolution with no words is a miss (spec 068 FR-028)", () => {
  it("the held beat knows whether the move scored", () => {
    const res = { words: [], delta: -5 } as unknown as MoveResolution;
    const state = derive(match({ movesPlayed: 4, lastResolution: res }), { holdMove: 4 });
    expect(state).toMatchObject({ kind: "scored", move: 4, delta: -5, missed: true });
  });
});
