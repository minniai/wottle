import { describe, expect, test } from "vitest";

import { finalContext, HERE_NOW, NO_RATING, rankLabel, RATING_PENDING, roundContext } from "@/lib/constants/copy";
import { finalCaption, ratingLine } from "@/lib/room/ledgerRows";

/**
 * Spec 045 decision 1 (15 September 2026): a directory challenge lets a player
 * choose their opponent, which the rating must not reward — so it says so.
 * This supersedes spec 044's clarification that every match is rated.
 */
describe("rank labelling", () => {
  test("a queue match reads ranked, a challenge unranked", () => {
    expect(rankLabel(true)).toBe("ranked");
    expect(rankLabel(false)).toBe("unranked");
  });

  test("the round caption carries the rank", () => {
    expect(roundContext(4)).toBe("ranked · round 4 of 10");
    expect(roundContext(4, true)).toBe("ranked · round 4 of 10");
    expect(roundContext(4, false)).toBe("unranked · round 4 of 10");
  });

  test("the final caption keeps its phase word and names only the exception", () => {
    // `final` is the phase, as `lobby` is; the review's §3 lists this string as
    // already matching the design, so a rated final is untouched.
    expect(finalContext("18:50")).toBe("final · 10 rounds · 18:50");
    expect(finalContext("18:50", false)).toBe("final · unranked · 10 rounds · 18:50");
    expect(finalCaption(0, 0)).toMatch(/^final · 10 rounds · /);
    expect(finalCaption(0, 0, false)).toMatch(/^final · unranked · 10 rounds · /);
  });

  test("the lobby offers a challenge as unranked", () => {
    expect(HERE_NOW).toContain("challenge for an unranked match");
    // "unranked match" contains "ranked match", so match the word, not a substring.
    expect(HERE_NOW).not.toMatch(/\branked match\b/);
  });

  test("rated defaults to true, so every existing caller is unchanged", () => {
    expect(roundContext(1)).toBe(roundContext(1, true));
    expect(finalContext("0:00")).toBe(finalContext("0:00", true));
  });

  test("an unranked final says so once, rather than pending forever", () => {
    // No rating row is ever written for an unranked match, so `rating pending`
    // would never resolve.
    expect(ratingLine(null, "p1", true, false)).toBe(NO_RATING);
    expect(ratingLine([], "p1", true, false)).toBe(NO_RATING);
    // A rated match with no row yet is still genuinely pending.
    expect(ratingLine(null, "p1", true)).toBe(RATING_PENDING);
  });
});
