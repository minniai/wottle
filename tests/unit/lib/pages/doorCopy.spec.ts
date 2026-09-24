import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { doorCopy } from "@/lib/pages/doorCopy";

/** Spec 070 US1.2, FR-008: the door's promise comes from the game's configuration, never from literals. */
describe("doorCopy", () => {
  it("writes the headline, lede and terms from the move limit and the clock", () => {
    const en = doorCopy(getCopy("en"), { moveLimit: 10, clockMs: 300_000, here: 4, matchesOn: 2 });
    expect(en.headline).toEqual(["Two players, one field,", "ten moves each."]);
    expect(en.headlinePhone).toEqual(["Two players,", "one field,", "ten moves each."]);
    expect(en.lede).toContain("Most points in five minutes wins.");
    expect(en.kicker).toBe("word + battle · a word duel for two");
    expect(en.count).toBe("4 here now · 2 matches on");
  });

  it("follows a different configuration, falling back to digits past the number words", () => {
    const en = doorCopy(getCopy("en"), { moveLimit: 14, clockMs: 180_000, here: 1, matchesOn: 1 });
    expect(en.headline[1]).toBe("14 moves each.");
    expect(en.lede).toContain("in three minutes");
    expect(en.count).toBe("1 here now · 1 match on");
  });

  it("writes Icelandic with the right number words and plural", () => {
    const is = doorCopy(getCopy("is"), { moveLimit: 10, clockMs: 300_000, here: 4, matchesOn: 1 });
    expect(is.headline).toEqual(["Tveir leikmenn, eitt borð,", "tíu leikir hvor."]);
    expect(is.lede).toContain("á fimm mínútum vinnur");
    expect(is.count).toBe("4 hér núna · 1 viðureign í gangi");
    expect(doorCopy(getCopy("is"), { moveLimit: 10, clockMs: 120_000, here: 4, matchesOn: 2 }).lede).toContain("á tveimur mínútum");
  });

  it("hides the count when nobody is here", () => {
    expect(doorCopy(getCopy("en"), { moveLimit: 10, clockMs: 300_000, here: 0, matchesOn: 0 }).count).toBeNull();
  });
});
