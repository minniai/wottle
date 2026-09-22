import { describe, expect, test } from "vitest";
import { copyEn } from "@/lib/i18n/copy/en";

import { finalCaption, ratingLine } from "@/lib/room/ledgerRows";

const { finalContext, HERE_NOW, QUEUE_CONTEXT, RATING_PENDING } = copyEn;

/**
 * Spec 048 US6 (20 September 2026): every match is rated, so no caption carries
 * a rank label and no room state mentions an unranked alternative. Spec 050:
 * the final caption carries the duration; since 2026-09-21 a match's caption
 * names no move of the viewer's (the bottom bar counts those).
 */
describe("captions, rated only", () => {
  test("the final caption carries the match's duration", () => {
    expect(finalContext("4:52")).toBe("final · 4:52");
    expect(finalCaption(292_000, copyEn)).toBe("final · 4:52");
  });

  test("the queue caption states the format without a rank", () => {
    expect(QUEUE_CONTEXT).toBe("10 moves each · one 5:00 clock");
  });

  test("the lobby directory heading is here now, nothing more", () => {
    expect(HERE_NOW).toBe("here now");
  });

  test("a final without a rating row is pending, never no rating change", () => {
    expect(ratingLine(null, "p1", true, copyEn)).toBe(RATING_PENDING);
    expect(ratingLine([], "p1", true, copyEn)).toBe(RATING_PENDING);
  });
});
