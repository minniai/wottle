import { describe, expect, it } from "vitest";

import { parseReviewParam } from "@/lib/review/reviewParam";

describe("parseReviewParam (spec 071 FR-040)", () => {
  it("is not review without the parameter", () => {
    expect(parseReviewParam(null, 20)).toBeNull();
  });

  it.each([
    ["7", 7, "7"],
    ["last", 20, "20"],
    ["", 20, "20"],
    ["abc", 20, "20"],
    ["0", 1, "1"],
    ["-3", 1, "1"],
    ["99", 20, "20"],
    ["7.5", 7, "7"],
  ])("reads %j as step %i, written back as %s", (raw, step, canonical) => {
    expect(parseReviewParam(raw, 20)).toEqual({ step, canonical });
  });
});
