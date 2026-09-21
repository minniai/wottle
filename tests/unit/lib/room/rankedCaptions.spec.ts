import { describe, expect, test } from "vitest";

import { finalContext, HERE_NOW, QUEUE_CONTEXT, RATING_PENDING, moveContext } from "@/lib/constants/copy";
import { finalCaption, ratingLine } from "@/lib/room/ledgerRows";

/**
 * Spec 048 US6 (20 September 2026): every match is rated, so no caption carries
 * a rank label and no room state mentions an unranked alternative. Spec 050:
 * the caption counts the viewer's moves and the final caption the duration.
 */
describe("captions, rated only", () => {
  test("the move caption is the move alone", () => {
    expect(moveContext(4)).toBe("move 4 of 10");
  });

  test("the final caption carries the match's duration", () => {
    expect(finalContext("4:52")).toBe("final · 4:52");
    expect(finalCaption(292_000)).toBe("final · 4:52");
  });

  test("the queue caption states the format without a rank", () => {
    expect(QUEUE_CONTEXT).toBe("10 moves each · one 5:00 clock");
  });

  test("the lobby directory heading is here now, nothing more", () => {
    expect(HERE_NOW).toBe("here now");
  });

  test("a final without a rating row is pending, never no rating change", () => {
    expect(ratingLine(null, "p1", true)).toBe(RATING_PENDING);
    expect(ratingLine([], "p1", true)).toBe(RATING_PENDING);
  });
});
