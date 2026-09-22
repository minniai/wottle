import { bandIdForWord } from "@/lib/room/bandGeometry";
import { copyEn } from "@/lib/i18n/copy/en";
import { describe, expect, it } from "vitest";

import { buildLedgerRows, buildMatchLedger, buildTerritory, buildVerdict, finalCaption, foldRows, liveText, ratingLine, type AccumulatedWord } from "@/lib/room/ledgerRows";

const A = "a";
const B = "b";
const words: AccumulatedWord[] = [
  { moveSeq: 1, globalSeq: 1, playerId: A, word: "borða", totalPoints: 24, coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }] },
  { moveSeq: 1, globalSeq: 2, playerId: B, word: "þoka", totalPoints: 14, coordinates: [{ x: 5, y: 6 }, { x: 5, y: 5 }] },
  { moveSeq: 2, globalSeq: 3, playerId: A, word: "vinur", totalPoints: 20, coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  { moveSeq: 2, globalSeq: 3, playerId: A, word: "una", totalPoints: 8, coordinates: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
  { moveSeq: 3, globalSeq: 5, playerId: B, word: "gilt", totalPoints: 15, coordinates: [{ x: 7, y: 4 }, { x: 7, y: 5 }] },
];

/** Spec 050 FR-016: rows by move number, each seat's column independent. */
describe("buildLedgerRows (design system §5.4, spec 050)", () => {
  it("ten rows: row N holds your Nth move and theirs; a move with no word writes its penalty; your next move is live", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 2, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "picking", letter: "T", value: 2 } }, copyEn);
    expect(rows).toHaveLength(10);
    expect(rows[0].status).toBe("past");
    expect(rows[0].you?.words.map((w) => w.word)).toEqual(["borða"]);
    expect(rows[0].you?.total).toBe(24);
    expect(rows[0].opp?.words[0]).toMatchObject({ word: "þoka", direction: "btt" });
    expect(rows[1].you?.words.map((w) => w.points)).toEqual([20, 8]);
    expect(rows[1].you?.total).toBe(28);
    // Kári's second move scored nothing: a miss, −5 (rules §5.6).
    expect(rows[1].opp).toEqual({ words: [], total: -5, miss: true });
    // Row 3 is your live row while Kári's third move already sits in his column.
    expect(rows[2]).toMatchObject({ status: "live", live: { line1: "picking · T (2)", line2: "tap a second letter" } });
    expect(rows[2].you).toBeNull();
    expect(rows[2].opp?.words.map((w) => w.word)).toEqual(["gilt"]);
    expect(rows.slice(3).every((r) => r.status === "future")).toBe(true);
  });

  it("a row the opponent has reached but you have not is past in their column only", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 1, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } }, copyEn);
    expect(rows[1].status).toBe("live");
    expect(rows[2].status).toBe("past");
    expect(rows[2].you).toBeNull();
    expect(rows[2].opp?.total).toBe(15);
  });

  it("seat is viewer-relative: player B sees their own words under you", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 3, opp: 2 }, completed: false, words, playerAId: A, viewerSlot: "player_b", live: { kind: "idle" } }, copyEn);
    expect(rows[0].you?.words[0].word).toBe("þoka");
    expect(rows[0].opp?.words[0].word).toBe("borða");
    expect(rows[3].status).toBe("live");
  });

  it("during the hold the scored move is the settled row and the next is not yet live", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 2, opp: 1 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, holdMove: 2, moveState: { kind: "scored", move: 2, opponentName: "Kári", delta: 28, next: 3 } }, copyEn);
    expect(rows[1]).toMatchObject({ status: "settled", live: { line1: "move 2 scored", line2: "you +28 · move 3 opens" } });
    expect(rows[1].you?.total).toBe(28);
    expect(rows[2].status).toBe("future");
  });

  it("with all ten moves the tenth row carries the waiting beat", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 10, opp: 8 }, completed: false, words: [], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, moveState: { kind: "done", opponentName: "Kári", opponentMoves: 8, clockMmSs: "1:12" } }, copyEn);
    expect(rows[9]).toMatchObject({ status: "live", live: { line1: "10 of 10 played" } });
    expect(rows.filter((r) => r.status === "live")).toHaveLength(1);
  });

  it("a completed match has no live row", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 10, opp: 10 }, completed: true, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } }, copyEn);
    expect(rows.some((r) => r.status === "live" || r.status === "settled")).toBe(false);
    expect(rows[9].status).toBe("past");
  });

  it("hidden words are kept out of their row until the reveal writes them", () => {
    const hidden = new Set(["a:gilt:7,4:ttb"]);
    const rows = buildLedgerRows({ movesPlayed: { you: 2, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, hiddenWordIds: hidden }, copyEn);
    expect(rows[2].opp?.words).toHaveLength(1);
    const rowsHidden = buildLedgerRows({ movesPlayed: { you: 2, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, hiddenWordIds: new Set(["b:gilt:7,4:ttb"]) }, copyEn);
    expect(rowsHidden[2].opp?.words).toHaveLength(0);
  });

  // Spec 047 amendment P1 (review S2): the instruction travels with the state.
  it("live text is a state line and an instruction line", () => {
    expect(liveText({ kind: "idle" }, copyEn)).toEqual({ line1: "pick a letter", line2: "" });
    expect(liveText({ kind: "picking", letter: "T", value: 2 }, copyEn)).toEqual({ line1: "picking · T (2)", line2: "tap a second letter" });
    expect(liveText({ kind: "previewing", total: null, words: [] }, copyEn)).toEqual({ line1: "previewing", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "previewing", total: 24, words: ["hestur"] }, copyEn)).toEqual({ line1: "24 · hestur", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "previewing", total: 0, words: [] }, copyEn)).toEqual({ line1: "0 · no word", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "played" }, copyEn)).toEqual({ line1: "scoring", line2: "" });
    expect(liveText({ kind: "illegal", ownerName: "Kári", round: 2 }, copyEn)).toEqual({ line1: "frozen · Kári M2 · pick another", line2: "" });
  });
});

describe("buildMatchLedger", () => {
  it("the caption names no move of the viewer's; the ledger clock carries the time, its phase and how much is left", () => {
    const model = buildMatchLedger({ movesPlayed: { you: 3, opp: 6 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {}, clockMs: 192_000 }, copyEn);
    expect(model.caption).toBe("");
    expect(model.clock).toBe("3:12");
    expect(model.clockPhase).toBe("calm");
    expect(model.clockFraction).toBeCloseTo(0.64);
    expect(buildMatchLedger({ movesPlayed: { you: 3, opp: 6 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {}, clockMs: 48_000 }, copyEn).clockPhase).toBe("low");
    const short = buildMatchLedger({ movesPlayed: { you: 3, opp: 6 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {}, clockMs: 12_000, clockLengthMs: 20_000 }, copyEn);
    expect(short.clockPhase).toBe("flash");
    expect(short.clockFraction).toBeCloseTo(0.6);
  });
});

describe("foldRows", () => {
  it("folds past moves older than the last three when a row overflows three lines", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 5, opp: 5 }, completed: false, words: [], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } }, copyEn);
    expect(foldRows(rows, rows.map(() => 1)).every((r) => !r.folded)).toBe(true);
    const folded = foldRows(rows, rows.map((_, i) => (i === 4 ? 4 : 1)));
    expect(folded.slice(0, 2).every((r) => r.folded)).toBe(true);
    expect(folded.slice(2, 5).every((r) => !r.folded)).toBe(true);
  });
});

describe("miss penalties in the rows (rules §5.6, 2026-09-21)", () => {
  it("each miss is −5; a scored move whose words are still hidden is not a miss", () => {
    const misses: AccumulatedWord[] = [words[0]];
    const rows = buildLedgerRows({ movesPlayed: { you: 4, opp: 0 }, completed: false, words: misses, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, hiddenWordIds: new Set([bandIdForWord(words[0])!]) }, copyEn);
    expect(rows[0].you).toMatchObject({ total: 0 });
    expect(rows[0].you?.miss).toBeFalsy();
    expect([rows[1].you?.total, rows[2].you?.total, rows[3].you?.total]).toEqual([-5, -5, -5]);
  });

  it("at a timed-out end the unplayed rows are penalised −5 each", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 8, opp: 10 }, completed: true, penalizeUnplayed: true, words: [words[0]], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } }, copyEn);
    expect(rows[8].you).toEqual({ words: [], total: -5, miss: true, unplayed: true });
    expect(rows[9].you).toEqual({ words: [], total: -5, miss: true, unplayed: true });
    expect(rows[8].status).toBe("past");
  });

  it("without a timed-out end, unplayed rows stay empty", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 8, opp: 10 }, completed: true, words: [words[0]], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } }, copyEn);
    expect(rows[8].you).toBeNull();
  });
});

describe("territory and verdict", () => {
  it("buildTerritory counts by seat", () => {
    expect(buildTerritory({ "0,0": { owner: "player_a" }, "1,0": { owner: "player_b" }, "2,0": { owner: "player_b" } }, "player_b")).toEqual({ you: 2, opp: 1, free: 97 });
  });
  const base = { viewerName: "Birna", opponentName: "Kári", viewerScore: 134, opponentScore: 88, viewerWords: 10, opponentWords: 8, viewerMoves: 10, opponentMoves: 10, territory: { you: 27, opp: 21, free: 52 } };
  it("both finished: the counted line", () => {
    expect(buildVerdict(base, copyEn)).toEqual({ winnerSeat: "you", scoreLine: "Birna wins 134–88", detailLine: "by 46 points · 10 words to 8 · territory 27–21" });
  });
  it("incomplete (2026-09-21): the score decides; the detail says who was short, then the margin", () => {
    expect(buildVerdict({ ...base, viewerScore: 134, opponentScore: 88, opponentMoves: 8, endedReason: "incomplete" }, copyEn)).toEqual({ winnerSeat: "you", scoreLine: "Birna wins 134–88", detailLine: "Kári played 8 of 10 · by 46 points" });
    expect(buildVerdict({ ...base, viewerScore: 88, opponentScore: 134, viewerMoves: 8, endedReason: "incomplete" }, copyEn)).toEqual({ winnerSeat: "opp", scoreLine: "Kári wins 134–88", detailLine: "Birna played 8 of 10 · by 46 points" });
  });
  it("both incomplete: neither finished, and the score still decides", () => {
    expect(buildVerdict({ ...base, viewerMoves: 6, opponentMoves: 3, endedReason: "both_incomplete" }, copyEn)).toEqual({ winnerSeat: "you", scoreLine: "Birna wins 134–88", detailLine: "neither finished · by 46 points" });
    expect(buildVerdict({ ...base, viewerScore: 50, opponentScore: 50, viewerMoves: 6, opponentMoves: 3, winnerSeat: null, endedReason: "both_incomplete" }, copyEn)).toEqual({ winnerSeat: null, scoreLine: "draw 50–50", detailLine: "neither finished" });
  });
  it("negative totals read with a real minus", () => {
    expect(buildVerdict({ ...base, viewerScore: -4, opponentScore: -12 }, copyEn).scoreLine).toBe("Birna wins −4 to −12");
  });
  it("forced ends keep their line", () => {
    expect(buildVerdict({ ...base, winnerSeat: "opp", endedReason: "forfeit" }, copyEn).detailLine).toBe("Birna resigned");
    expect(buildVerdict({ ...base, winnerSeat: "you", endedReason: "disconnect" }, copyEn).detailLine).toBe("Kári left");
  });
  it("ratingLine and finalCaption", () => {
    expect(ratingLine([{ playerId: "p", ratingBefore: 1191, ratingAfter: 1203, ratingDelta: 12 }], "p", true, copyEn)).toBe("1191 → 1203 · +12 · wins");
    expect(ratingLine(null, "p", true, copyEn)).toBe("rating pending");
    expect(finalCaption(292_000, copyEn)).toBe("final · 4:52");
  });
});
