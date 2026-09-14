import { describe, expect, it } from "vitest";

import { buildLedgerRows, buildMatchLedger, buildTerritory, liveText } from "@/lib/room/ledgerRows";

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
    expect(rows[2]).toMatchObject({ status: "live", liveText: "picking · T (2)" });
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

  it("live text follows the state", () => {
    expect(liveText({ kind: "played" })).toBe("played ●");
    expect(liveText({ kind: "idle" })).toBe("");
  });
});

describe("buildTerritory", () => {
  it("counts frozen tiles per seat and the free remainder", () => {
    const t = buildTerritory({ "0,0": { owner: "player_a" }, "1,0": { owner: "player_a" }, "2,0": { owner: "player_b" } }, "player_b");
    expect(t).toEqual({ you: 1, opp: 2, free: 97 });
  });
});

describe("buildMatchLedger", () => {
  it("caption reads the round context and hint defaults to tap a second letter", () => {
    const model = buildMatchLedger({ currentRound: 4, completed: false, words: [], playerAId: A, viewerSlot: "player_a", live: { kind: "idle" }, frozenTiles: {} });
    expect(model.caption).toBe("ranked · round 4 of 10");
    expect(model.hint).toBe("tap a second letter");
    expect(model.territory.free).toBe(100);
  });
});
