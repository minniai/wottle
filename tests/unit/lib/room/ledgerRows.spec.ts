import { describe, expect, it } from "vitest";

import { buildLedgerRows, buildMatchLedger, buildTerritory, buildVerdict, finalCaption, foldRows, liveText, ratingLine } from "@/lib/room/ledgerRows";

const A = "a";
const B = "b";
const words = [
  { roundNumber: 1, playerId: A, word: "borða", totalPoints: 24, coordinates: [{ x: 1, y: 2 }, { x: 2, y: 2 }] },
  { roundNumber: 1, playerId: B, word: "þoka", totalPoints: 14, coordinates: [{ x: 5, y: 6 }, { x: 5, y: 5 }] },
  { roundNumber: 2, playerId: A, word: "vinur", totalPoints: 20, coordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  { roundNumber: 2, playerId: A, word: "una", totalPoints: 0, coordinates: [{ x: 0, y: 1 }, { x: 1, y: 1 }], isDuplicate: true },
];

describe("buildLedgerRows (design system §5.4)", () => {
  it("ten rows: past rows carry both seats' words and totals, the current round is live, the rest future", () => {
    const rows = buildLedgerRows({ currentRound: 3, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "picking", letter: "T", value: 2 } });
    expect(rows).toHaveLength(10);
    expect(rows[0].status).toBe("past");
    expect(rows[0].you?.words.map((w) => w.word)).toEqual(["borða"]);
    expect(rows[0].you?.total).toBe(24);
    expect(rows[0].opp?.words[0]).toMatchObject({ word: "þoka", direction: "btt" });
    expect(rows[1].you?.words.map((w) => w.points)).toEqual([20, 0]);
    expect(rows[1].you?.total).toBe(20);
    expect(rows[1].opp).toBeNull();
    expect(rows[2]).toMatchObject({ status: "live", live: { line1: "picking · T (2)", line2: "tap a second letter" } });
    expect(rows.slice(3).every((r) => r.status === "future")).toBe(true);
  });

  it("seat is viewer-relative: player B sees their own words under you", () => {
    const rows = buildLedgerRows({ currentRound: 2, completed: false, words, playerAId: A, viewerSlot: "player_b", live: { kind: "idle" } });
    expect(rows[0].you?.words[0].word).toBe("þoka");
    expect(rows[0].opp?.words[0].word).toBe("borða");
  });

  it("words that already landed in the current round are shown instead of the live text", () => {
    const rows = buildLedgerRows({ currentRound: 2, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "played" } });
    expect(rows[1].status).toBe("past");
    expect(rows[1].you?.words.map((w) => w.word)).toEqual(["vinur", "una"]);
    expect(rows.some((r) => r.status === "live")).toBe(false);
  });

  it("a completed match has no live row", () => {
    const rows = buildLedgerRows({ currentRound: 10, completed: true, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } });
    expect(rows.some((r) => r.status === "live")).toBe(false);
    expect(rows[9].status).toBe("past");
  });

  // Spec 047 amendment P1 (review S2): the instruction travels with the state.
  // Line 1 says where the player is; line 2, when present, what to do next.
  it("live text is a state line and an instruction line", () => {
    expect(liveText({ kind: "idle" })).toEqual({ line1: "pick a letter", line2: "" });
    expect(liveText({ kind: "picking", letter: "T", value: 2 })).toEqual({ line1: "picking · T (2)", line2: "tap a second letter" });
    expect(liveText({ kind: "previewing", total: null, words: [] })).toEqual({ line1: "previewing", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "previewing", total: 24, words: ["hestur"] })).toEqual({ line1: "24 · hestur", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "previewing", total: 0, words: [] })).toEqual({ line1: "0 · no word", line2: "tap again to play · esc cancels" });
    expect(liveText({ kind: "played" })).toEqual({ line1: "played ●", line2: "" });
    expect(liveText({ kind: "illegal", ownerName: "Kári", round: 2 })).toEqual({ line1: "frozen · Kári R2 · pick another", line2: "" });
    expect(liveText({ kind: "resolving" })).toEqual({ line1: "resolving", line2: "" });
  });
});

describe("buildTerritory", () => {
  it("counts frozen tiles per seat and the free remainder", () => {
    const t = buildTerritory({ "0,0": { owner: "player_a" }, "1,0": { owner: "player_a" }, "2,0": { owner: "player_b" } }, "player_b");
    expect(t).toEqual({ you: 1, opp: 2, free: 97 });
  });
});

describe("buildMatchLedger", () => {
  it("caption reads the round context; the hint is empty unless a match-level line is given", () => {
    const model = buildMatchLedger({ currentRound: 4, completed: false, words: [], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {} });
    expect(model.caption).toBe("round 4 of 10");
    expect(model.hint).toBe("");
    expect(model.territory.free).toBe(100);
  });
});

describe("foldRows (fold rule)", () => {
  const rows = buildLedgerRows({ currentRound: 6, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" } });
  it("leaves rows alone while every row fits in three lines", () => {
    expect(foldRows(rows, rows.map(() => 2))).toBe(rows);
  });
  it("collapses past rounds older than the last three to totals when any row overflows", () => {
    const folded = foldRows(rows, rows.map((_, i) => (i === 4 ? 4 : 1)));
    const past = folded.filter((r) => r.status === "past");
    expect(past.map((r) => r.folded)).toEqual([true, true, false, false, false]);
    expect(folded[5].folded).toBe(false);
  });
});

describe("buildVerdict (design system §8)", () => {
  const territory = { you: 25, opp: 32, free: 43 };
  it("states the winner once, with margin, word counts and territory in the winner's order", () => {
    expect(buildVerdict({ viewerName: "Birna", opponentName: "Kári", viewerScore: 127, opponentScore: 170, viewerWords: 8, opponentWords: 10, territory })).toEqual({
      winnerSeat: "opp",
      scoreLine: "Kári wins 170–127",
      detailLine: "by 43 points · 10 words to 8 · territory 32–25",
    });
  });
  it("a viewer win uses the same voice", () => {
    const v = buildVerdict({ viewerName: "Birna", opponentName: "Kári", viewerScore: 170, opponentScore: 127, viewerWords: 10, opponentWords: 8, territory: { you: 32, opp: 25, free: 43 } });
    expect(v.winnerSeat).toBe("you");
    expect(v.scoreLine).toBe("Birna wins 170–127");
  });
  it("a draw has no winner and no exclamation", () => {
    const v = buildVerdict({ viewerName: "B", opponentName: "K", viewerScore: 90, opponentScore: 90, viewerWords: 5, opponentWords: 5, territory });
    expect(v.winnerSeat).toBeNull();
    expect(v.scoreLine).toBe("draw 90–90");
    expect(v.scoreLine + v.detailLine).not.toContain("!");
  });
});

describe("final bars (design system §5.3, §8)", () => {
  it("rating line shows before → after · ±n and wins for the winner; pending when absent", () => {
    const rows = [{ playerId: "a", ratingBefore: 1191, ratingAfter: 1203, ratingDelta: 12 }, { playerId: "b", ratingBefore: 1204, ratingAfter: 1192, ratingDelta: -12 }];
    expect(ratingLine(rows, "a", true)).toBe("1191 → 1203 · +12 · wins");
    expect(ratingLine(rows, "b", false)).toBe("1204 → 1192 · −12");
    expect(ratingLine(null, "a", true)).toBe("rating pending");
    expect(ratingLine(rows, "zzz", false)).toBe("rating pending");
  });
  it("final caption reports the clock time both players used", () => {
    expect(finalCaption(300_000 - 500_000 / 2, 300_000 - 630_000 / 2)).toBe("final · 10 of 10 · 9:25");
    expect(finalCaption(300_000, 300_000)).toBe("final · 10 of 10 · 0:00");
  });
});


describe("settle hold rows (spec 048 FR-022)", () => {
  const scored = { kind: "scored", round: 2, next: 3, you: 20, opp: 0, opponentName: "b" } as const;
  it("the held round is settled with its words and lines; the current round stays future", () => {
    const rows = buildLedgerRows({ currentRound: 3, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, roundState: scored, holdRound: 2 });
    expect(rows[1]).toMatchObject({ status: "settled", live: { line1: "round 2 scored", line2: "you +20 · b +0 · round 3 opens in 1" } });
    expect(rows[1].you?.words.map((w) => w.word)).toEqual(["vinur", "una"]); // carried for the phone sheet and hover
    expect(rows[2].status).toBe("future");
    expect(rows.some((r) => r.status === "live")).toBe(false);
  });
  it("without a hold the round state writes line 1 and the field writes line 2", () => {
    const rows = buildLedgerRows({ currentRound: 3, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "picking", letter: "T", value: 2 }, roundState: { kind: "yourMove", round: 3, opponentName: "b" }, holdRound: null });
    expect(rows[2]).toMatchObject({ status: "live", live: { line1: "round 3 · your move", line2: "picking · T (2) · tap a second letter" } });
  });
  it("buildMatchLedger exposes the round and completion for the rail", () => {
    const model = buildMatchLedger({ currentRound: 3, completed: false, words, playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {} });
    expect(model).toMatchObject({ round: 3, completed: false });
  });
});
