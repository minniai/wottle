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
  it("ten rows: row N holds your Nth move and theirs; a blank move writes 0; your next move is live", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 2, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "picking", letter: "T", value: 2 } });
    expect(rows).toHaveLength(10);
    expect(rows[0].status).toBe("past");
    expect(rows[0].you?.words.map((w) => w.word)).toEqual(["borða"]);
    expect(rows[0].you?.total).toBe(24);
    expect(rows[0].opp?.words[0]).toMatchObject({ word: "þoka", direction: "btt" });
    expect(rows[1].you?.words.map((w) => w.points)).toEqual([20, 8]);
    expect(rows[1].you?.total).toBe(28);
    // Kári's second move scored nothing: played, so it writes 0, not nothing.
    expect(rows[1].opp).toEqual({ words: [], total: 0 });
    // Row 3 is your live row while Kári's third move already sits in his column.
    expect(rows[2]).toMatchObject({ status: "live", live: { line1: "picking · T (2)", line2: "tap a second letter" } });
    expect(rows[2].you).toBeNull();
    expect(rows[2].opp?.words.map((w) => w.word)).toEqual(["gilt"]);
    expect(rows.slice(3).every((r) => r.status === "future")).toBe(true);
  });

  it("a row the opponent has reached but you have not is past in their column only", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 1, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } });
    expect(rows[1].status).toBe("live");
    expect(rows[2].status).toBe("past");
    expect(rows[2].you).toBeNull();
    expect(rows[2].opp?.total).toBe(15);
  });

  it("seat is viewer-relative: player B sees their own words under you", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 3, opp: 2 }, completed: false, words, playerAId: A, viewerSlot: "player_b", live: { kind: "idle" } });
    expect(rows[0].you?.words[0].word).toBe("þoka");
    expect(rows[0].opp?.words[0].word).toBe("borða");
    expect(rows[3].status).toBe("live");
  });

  it("during the hold the scored move is the settled row and the next is not yet live", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 2, opp: 1 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, holdMove: 2, moveState: { kind: "scored", move: 2, opponentName: "Kári", delta: 28, next: 3 } });
    expect(rows[1]).toMatchObject({ status: "settled", live: { line1: "move 2 scored", line2: "you +28 · move 3 opens" } });
    expect(rows[1].you?.total).toBe(28);
    expect(rows[2].status).toBe("future");
  });

  it("with all ten moves the tenth row carries the waiting beat", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 10, opp: 8 }, completed: false, words: [], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, moveState: { kind: "done", opponentName: "Kári", opponentMoves: 8, clockMmSs: "1:12" } });
    expect(rows[9]).toMatchObject({ status: "live", live: { line1: "10 of 10 played" } });
    expect(rows.filter((r) => r.status === "live")).toHaveLength(1);
  });

  it("a completed match has no live row", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 10, opp: 10 }, completed: true, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } });
    expect(rows.some((r) => r.status === "live" || r.status === "settled")).toBe(false);
    expect(rows[9].status).toBe("past");
  });

  it("hidden words are kept out of their row until the reveal writes them", () => {
    const hidden = new Set(["a:gilt:7,4:ttb"]);
    const rows = buildLedgerRows({ movesPlayed: { you: 2, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, hiddenWordIds: hidden });
    expect(rows[2].opp?.words).toHaveLength(1);
    const rowsHidden = buildLedgerRows({ movesPlayed: { you: 2, opp: 3 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, hiddenWordIds: new Set(["b:gilt:7,4:ttb"]) });
    expect(rowsHidden[2].opp?.words).toHaveLength(0);
  });

  // Spec 047 amendment P1 (review S2): the instruction travels with the state.
  it("live text is a state line and an instruction line", () => {
    expect(liveText({ kind: "idle" })).toEqual({ line1: "pick a letter", line2: "" });
    expect(liveText({ kind: "picking", letter: "T", value: 2 })).toEqual({ line1: "picking · T (2)", line2: "tap a second letter" });
    expect(liveText({ kind: "previewing", total: null, words: [] })).toEqual({ line1: "previewing", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "previewing", total: 24, words: ["hestur"] })).toEqual({ line1: "24 · hestur", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "previewing", total: 0, words: [] })).toEqual({ line1: "0 · no word", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "played" })).toEqual({ line1: "scoring", line2: "" });
    expect(liveText({ kind: "illegal", ownerName: "Kári", round: 2 })).toEqual({ line1: "frozen · Kári M2 · pick another", line2: "" });
  });
});

describe("buildMatchLedger", () => {
  it("caption is the viewer's next move; the clock is drawn once beside it", () => {
    const model = buildMatchLedger({ movesPlayed: { you: 3, opp: 6 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {}, clockMs: 192_000 });
    expect(model.caption).toBe("move 4 of 10");
    expect(model.clock).toBe("3:12");
    expect(model.clockLow).toBe(false);
    expect(model.movesPlayed).toBe(3);
    expect(buildMatchLedger({ movesPlayed: { you: 3, opp: 6 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {}, clockMs: 48_000 }).clockLow).toBe(true);
  });
  it("the caption never exceeds the limit", () => {
    expect(buildMatchLedger({ movesPlayed: { you: 10, opp: 6 }, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {} }).caption).toBe("move 10 of 10");
  });
});

describe("foldRows", () => {
  it("folds past moves older than the last three when a row overflows three lines", () => {
    const rows = buildLedgerRows({ movesPlayed: { you: 5, opp: 5 }, completed: false, words: [], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } });
    expect(foldRows(rows, rows.map(() => 1)).every((r) => !r.folded)).toBe(true);
    const folded = foldRows(rows, rows.map((_, i) => (i === 4 ? 4 : 1)));
    expect(folded.slice(0, 2).every((r) => r.folded)).toBe(true);
    expect(folded.slice(2, 5).every((r) => !r.folded)).toBe(true);
  });
});

describe("territory and verdict", () => {
  it("buildTerritory counts by seat", () => {
    expect(buildTerritory({ "0,0": { owner: "player_a" }, "1,0": { owner: "player_b" }, "2,0": { owner: "player_b" } }, "player_b")).toEqual({ you: 2, opp: 1, free: 97 });
  });
  const base = { viewerName: "Birna", opponentName: "Kári", viewerScore: 134, opponentScore: 88, viewerWords: 10, opponentWords: 8, viewerMoves: 10, opponentMoves: 10, territory: { you: 27, opp: 21, free: 52 } };
  it("both finished: the counted line", () => {
    expect(buildVerdict(base)).toEqual({ winnerSeat: "you", scoreLine: "Birna wins 134–88", detailLine: "by 46 points · 10 words to 8 · territory 27–21" });
  });
  it("incomplete (spec 050): the winner recorded by the server, the detail says the count", () => {
    expect(buildVerdict({ ...base, viewerScore: 88, opponentScore: 134, opponentMoves: 8, winnerSeat: "you", endedReason: "incomplete" })).toEqual({ winnerSeat: "you", scoreLine: "Birna wins 88–134", detailLine: "Kári played 8 of 10" });
  });
  it("both incomplete: a draw that says neither finished", () => {
    expect(buildVerdict({ ...base, viewerMoves: 6, opponentMoves: 3, winnerSeat: null, endedReason: "both_incomplete" })).toEqual({ winnerSeat: null, scoreLine: "draw 134–88", detailLine: "neither finished" });
  });
  it("forced ends keep their line", () => {
    expect(buildVerdict({ ...base, winnerSeat: "opp", endedReason: "forfeit" }).detailLine).toBe("Birna resigned");
    expect(buildVerdict({ ...base, winnerSeat: "you", endedReason: "disconnect" }).detailLine).toBe("Kári left");
  });
  it("ratingLine and finalCaption", () => {
    expect(ratingLine([{ playerId: "p", ratingBefore: 1191, ratingAfter: 1203, ratingDelta: 12 }], "p", true)).toBe("1191 → 1203 · +12 · wins");
    expect(ratingLine(null, "p", true)).toBe("rating pending");
    expect(finalCaption(292_000)).toBe("final · 4:52");
  });
});
