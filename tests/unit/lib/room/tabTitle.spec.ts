import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { tabTitle } from "@/lib/room/tabTitle";

/** Spec 068 FR-025: the tab says the clock and your move while a match is live. */
describe("tabTitle", () => {
  it("reads the clock, your move and the name during a live match", () => {
    expect(tabTitle({ live: true, clockMs: 192_000, move: 4 }, copyEn)).toBe("3:12 · move 4 · Wottle");
    expect(tabTitle({ live: true, clockMs: 192_000, move: 4 }, copyIs)).toBe("3:12 · leikur 4 · Orðusta");
  });

  it("is the name alone outside a live match", () => {
    expect(tabTitle({ live: false, clockMs: 0, move: 10 }, copyEn)).toBe("Wottle");
    expect(tabTitle({ live: false, clockMs: 0, move: 1 }, copyIs)).toBe("Orðusta");
  });

  it("names the winner once the match is over (spec 071 FR-008)", () => {
    expect(tabTitle({ live: false, clockMs: 0, move: 10, result: { winnerName: "Birna" } }, copyEn)).toBe("Birna wins · Wottle");
    expect(tabTitle({ live: false, clockMs: 0, move: 10, result: { winnerName: "Birna" } }, copyIs)).toBe("Birna vann · Orðusta");
    expect(tabTitle({ live: false, clockMs: 0, move: 10, result: { winnerName: null } }, copyEn)).toBe("Draw · Wottle");
    expect(tabTitle({ live: false, clockMs: 0, move: 10, result: { winnerName: null } }, copyIs)).toBe("Jafntefli · Orðusta");
  });
});
