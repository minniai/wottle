import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import type { MoveState } from "@/lib/room/moveState";
import { deriveScoreboard, type ScoreboardInput, type ScoreboardSeat } from "@/lib/room/scoreboard";

/** Spec 068, contracts/scoreboard.md: the canvas's MatchRail values (EN-M, Birna vs Kári). */
const K = "Kári";
const yourMove = (move: number): MoveState => ({ kind: "yourMove", move, opponentName: K });

function seat(over: Partial<ScoreboardSeat> = {}): ScoreboardSeat {
  return { name: "Birna", rating: 1310, movesPlayed: 3, inFlight: false, score: 44, ...over };
}

function input(over: Partial<ScoreboardInput> = {}): ScoreboardInput {
  return {
    phase: "live",
    moveState: yourMove(4),
    remainingMs: 192_000,
    clockLengthMs: 300_000,
    moveLimit: 10,
    readOnly: false,
    you: seat(),
    opp: seat({ name: K, rating: 1265, movesPlayed: 6, score: 34 }),
    ...over,
  };
}

const board = (over: Partial<ScoreboardInput> = {}) => deriveScoreboard(input(over), copyEn);

describe("deriveScoreboard: the clock row", () => {
  it("reads the pace while the move is yours: 192s for 7 moves left, 39 ticks", () => {
    const { clock } = board();
    expect(clock.label).toBe("match clock");
    expect(clock.detail).toBe("≈27s a move");
    expect(clock.numeral).toBe("3:12");
    expect(clock.ticksLeft).toBe(39);
    expect(clock.blocks).toEqual([6, 6, 6, 6, 6, 6, 3, 0, 0, 0]);
    expect(clock.phase).toBe("running");
  });

  it("gives no pace when the move is not yours", () => {
    expect(board({ moveState: { kind: "scoring", move: 4, opponentName: K } }).clock).toMatchObject({ label: "match clock", detail: "" });
    expect(board({ moveState: null }).clock.detail).toBe("");
  });

  it("gets heavier under a minute and counts the last 15 seconds, then reads `time`", () => {
    expect(board({ remainingMs: 48_000, you: seat({ movesPlayed: 7 }) }).clock).toMatchObject({ phase: "underMinute", label: "under a minute", detail: "≈16s a move" });
    expect(board({ remainingMs: 12_000 }).clock).toMatchObject({ phase: "lastSeconds", label: "last 12s" });
    expect(board({ remainingMs: 0, moveState: { kind: "timeUp", opponentName: K } }).clock).toMatchObject({ phase: "time", label: "time", ticksLeft: 0 });
  });

  it("the pace is whole seconds, `<1s a move` rather than ≈0s", () => {
    expect(board({ remainingMs: 800 }).clock).toMatchObject({ label: "last 1s", detail: "<1s a move" });
    expect(board({ remainingMs: 20_000, you: seat({ movesPlayed: 0 }) }).clock.detail).toBe("≈2s a move");
  });

  it("while starting it counts the start and fills from left to right", () => {
    const early = board({ phase: "starting", msToStart: 3_000, moveState: { kind: "starting", seconds: 3, opponentName: K } });
    const late = board({ phase: "starting", msToStart: 1_000, moveState: { kind: "starting", seconds: 1, opponentName: K } });
    expect(early.clock).toMatchObject({ phase: "starting", label: "starts in 3", numeral: "5:00", ticksLeft: 0 });
    expect(late.clock.ticksLeft).toBe(40);
  });

  it("at match over holds the time that was left", () => {
    const { clock } = board({ phase: "over", moveState: null, remainingMs: 8_000, elapsedMs: 292_000 });
    expect(clock).toMatchObject({ phase: "over", label: "match over", detail: "4:52 of 5:00", numeral: "0:08" });
  });
});

describe("deriveScoreboard: the player rows", () => {
  it("writes the opponent's count and yours, yours in the seat colour while the move is yours", () => {
    const { opp, you } = board();
    expect(opp).toMatchObject({ seat: "opp", name: K, muted: "1265", suffix: "6 of 10 · playing", tone: "muted", total: 34, movesLeft: 4 });
    expect(you).toMatchObject({ seat: "you", name: "Birna", muted: "1310 · you", suffix: "move 4 of 10", tone: "seat", total: 44, movesLeft: 7 });
    expect(opp.segments.filter((s) => s === "spent")).toHaveLength(6);
  });

  it("scoring and done, for both seats", () => {
    const scoring = board({ moveState: { kind: "scoring", move: 4, opponentName: K }, you: seat({ inFlight: true }), opp: seat({ name: K, rating: 1265, movesPlayed: 6, inFlight: true }) });
    expect(scoring.you).toMatchObject({ suffix: "move 4 of 10 · scoring", tone: "muted" });
    expect(scoring.opp.suffix).toBe("6 of 10 · scoring");
    expect(scoring.you.segments[6]).toBe("scoring");
    const done = board({ moveState: { kind: "done", opponentName: K, opponentMoves: 10, clockMmSs: "1:12" }, you: seat({ movesPlayed: 10 }), opp: seat({ name: K, movesPlayed: 10 }) });
    expect(done.you.suffix).toBe("10 of 10 · done");
    expect(done.opp.suffix).toBe("10 of 10 · done");
  });

  it("says `behind pace` in words when a full block short, and never with nothing left to play", () => {
    const behind = board({ remainingMs: 48_000, moveState: yourMove(8), you: seat({ movesPlayed: 7, score: 69 }) });
    expect(behind.you).toMatchObject({ muted: "1310", suffix: "move 8 · behind pace", tone: "seat", behindPace: true });
    expect(board().you.behindPace).toBe(false);
    const done = board({ remainingMs: 5_000, moveState: { kind: "done", opponentName: K, opponentMoves: 6, clockMmSs: "0:05" }, you: seat({ movesPlayed: 10 }) });
    expect(done.you.behindPace).toBe(false);
  });

  it("the opponent reconnecting, then gone, with their moves outlined; never a frozen 0:00 left", () => {
    const window = board({ opp: seat({ name: K, rating: 1265, movesPlayed: 8, reconnectMsLeft: 42_000 }) });
    expect(window.opp).toMatchObject({ muted: "1265", suffix: "reconnecting · 0:42 left", laneMode: "outlined" });
    const gone = board({ opp: seat({ name: K, rating: 1265, movesPlayed: 8, reconnectMsLeft: 0, goneForMs: 124_000 }) });
    expect(gone.opp).toMatchObject({ muted: "1265", suffix: "8 of 10 · gone for 2:04", laneMode: "outlined" });
    expect(board().opp.laneMode).toBe("moves");
  });

  it("both seats read `ready` while starting", () => {
    const start = board({ phase: "starting", msToStart: 2_000, moveState: { kind: "starting", seconds: 2, opponentName: K }, you: seat({ movesPlayed: 0 }), opp: seat({ name: K, movesPlayed: 0 }) });
    expect(start.you.suffix).toBe("ready");
    expect(start.opp.suffix).toBe("ready");
  });

  it("at match over the rows carry the rating lines, or `rating pending`", () => {
    const over = board({ phase: "over", moveState: null, you: seat({ finalLine: "1204 → 1212 · +8 · wins" }), opp: seat({ name: K, finalLine: "rating pending" }) });
    expect(over.you).toMatchObject({ muted: "1204 → 1212 · +8 · wins", suffix: null });
    expect(over.opp).toMatchObject({ muted: "rating pending", suffix: null });
  });

  it("a read-only viewer sees no `you`", () => {
    const view = deriveScoreboard(input({ readOnly: true, moveState: null }), copyEn);
    expect(view.you.muted).toBe("1310");
    expect(view.opp.muted).toBe("1265");
  });

  it("an unrated player shows `unrated`", () => {
    expect(board({ opp: seat({ name: K, rating: null, movesPlayed: 6 }) }).opp.muted).toBe("unrated");
    expect(board({ you: seat({ rating: null }) }).you.muted).toBe("unrated · you");
  });
});

describe("deriveScoreboard on a phone (spec 068 FR-009, artboard PhoneMatch)", () => {
  const phone = (over: Partial<ScoreboardInput> = {}) => deriveScoreboard({ ...input(over), compact: true }, copyEn);

  it("keeps the square and the name, and writes the short count: `6 of 10`, `move 4`", () => {
    const view = phone();
    expect(view.opp).toMatchObject({ name: K, muted: "", suffix: "6 of 10" });
    expect(view.you).toMatchObject({ name: "Birna", muted: "", suffix: "move 4", tone: "seat" });
  });

  it("the states that matter still read, short", () => {
    expect(phone({ opp: seat({ name: K, movesPlayed: 8, reconnectMsLeft: 0, goneForMs: 124_000 }) }).opp.suffix).toBe("gone for 2:04");
    expect(phone({ opp: seat({ name: K, movesPlayed: 8, reconnectMsLeft: 42_000 }) }).opp.suffix).toBe("reconnecting · 0:42 left");
    expect(phone({ remainingMs: 48_000, moveState: yourMove(8), you: seat({ movesPlayed: 7 }) }).you.suffix).toBe("behind pace");
    expect(phone({ you: seat({ offline: true }) }).you.suffix).toBe("offline");
    expect(phone({ moveState: { kind: "done", opponentName: K, opponentMoves: 6, clockMmSs: "1:12" }, you: seat({ movesPlayed: 10 }) }).you.suffix).toBe("10 of 10");
  });
});

describe("deriveScoreboard in Icelandic", () => {
  it("writes the same facts in the board's language", () => {
    const view = deriveScoreboard(input({ opp: seat({ name: K, rating: 1265, movesPlayed: 8, reconnectMsLeft: 0, goneForMs: 124_000 }) }), copyIs);
    expect(view.clock).toMatchObject({ label: "leikklukka", detail: "≈27 sek á leik" });
    expect(view.you.suffix).toBe("leikur 4 af 10");
    expect(view.opp.suffix).toBe("8 af 10 · án tengingar í 2:04");
  });
});
