import { describe, expect, it } from "vitest";

import { copyEn as en } from "@/lib/i18n/copy/en";
import { copyIs as is } from "@/lib/i18n/copy/is";
import { resultDetail, type DetailFacts } from "@/lib/room/resultDetail";

const WIN: DetailFacts = {
  endedReason: "moves_complete",
  winnerName: "Birna",
  loserName: "Kári",
  margin: 46,
  words: [10, 8],
  territory: [27, 21],
  short: null,
  endClock: "3:12",
};

describe("resultDetail (spec 071 FR-004)", () => {
  it.each([
    ["both finished", WIN, ["by 46 points", "10 words to 8", "territory 27–21"], ["með 46 stigum", "10 orð gegn 8", "svæði 27–21"]],
    ["one short at 0:00", { ...WIN, endedReason: "incomplete", margin: 12, short: { name: "Kári", moves: 8 } }, ["Kári played 8 of 10", "by 12 points"], ["Kári lék 8 af 10", "með 12 stigum"]],
    ["neither finished", { ...WIN, endedReason: "both_incomplete", margin: 12 }, ["neither finished", "by 12 points"], ["hvorugt kláraði", "með 12 stigum"]],
    ["a resignation", { ...WIN, endedReason: "forfeit" }, ["Kári resigned", "3:12"], ["Kári gafst upp", "3:12"]],
    ["an early end", { ...WIN, endedReason: "ended_early" }, ["ended early", "Kári was gone"], ["lokið snemma", "Kári hætti að spila"]],
    ["a player who left", { ...WIN, endedReason: "abandoned" }, ["Kári left"], ["Kári fór"]],
  ] as const)("says why for %s, once, in both languages", (_name, facts, english, icelandic) => {
    expect(resultDetail(facts as DetailFacts, en)).toEqual(english);
    expect(resultDetail(facts as DetailFacts, is)).toEqual(icelandic);
  });

  it("drops the margin from a draw", () => {
    expect(resultDetail({ ...WIN, winnerName: null, margin: 0 }, en)).toEqual(["10 words to 8", "territory 27–21"]);
    expect(resultDetail({ ...WIN, endedReason: "both_incomplete", winnerName: null, margin: 0 }, en)).toEqual(["neither finished"]);
  });

  it("leaves out the resignation clock when it is not known", () => {
    expect(resultDetail({ ...WIN, endedReason: "forfeit", endClock: null }, en)).toEqual(["Kári resigned"]);
  });

  it("never repeats a clause", () => {
    for (const reason of ["moves_complete", "incomplete", "both_incomplete", "forfeit", "ended_early"] as const) {
      const clauses = resultDetail({ ...WIN, endedReason: reason, short: { name: "Kári", moves: 8 } }, en);
      expect(new Set(clauses).size).toBe(clauses.length);
    }
  });

  it("names the player who was gone in an early end, even when the totals are level", () => {
    expect(resultDetail({ ...WIN, endedReason: "ended_early", winnerName: null, margin: 0, loserName: "Birna", short: { name: "Kári", moves: 0 } }, en)).toEqual(["ended early", "Kári was gone"]);
  });
});

