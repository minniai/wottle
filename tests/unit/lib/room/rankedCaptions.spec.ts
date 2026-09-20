import { describe, expect, test } from "vitest";

import { finalContext, HERE_NOW, QUEUE_CONTEXT, RATING_PENDING, roundContext } from "@/lib/constants/copy";
import { finalCaption, ratingLine } from "@/lib/room/ledgerRows";

/**
 * Spec 048 US6 (20 September 2026): every match is rated, so no caption carries
 * a rank label and no room state mentions an unranked alternative. This
 * supersedes spec 045 decision 1.
 */
describe("captions, rated only", () => {
  test("the round caption is the round alone", () => {
    expect(roundContext(4)).toBe("round 4 of 10");
  });

  test("the final caption counts ten of ten, as the rail does", () => {
    expect(finalContext("18:50")).toBe("final · 10 of 10 · 18:50");
    expect(finalCaption(0, 0)).toMatch(/^final · 10 of 10 · /);
  });

  test("the queue caption states the format without a rank", () => {
    expect(QUEUE_CONTEXT).toBe("10 rounds · 5:00 clocks");
  });

  test("the lobby directory heading is here now, nothing more", () => {
    expect(HERE_NOW).toBe("here now");
  });

  test("a final without a rating row is pending, never no rating change", () => {
    expect(ratingLine(null, "p1", true)).toBe(RATING_PENDING);
    expect(ratingLine([], "p1", true)).toBe(RATING_PENDING);
  });
});
