import { describe, expectTypeOf, it } from "vitest";

import type { MatchEndedReason } from "@/lib/types/match";

describe("MatchEndedReason type", () => {
  it("includes timeout as a valid value", () => {
    expectTypeOf<"incomplete">().toMatchTypeOf<MatchEndedReason>();
  });

  it("includes round_limit as a valid value", () => {
    expectTypeOf<"moves_complete">().toMatchTypeOf<MatchEndedReason>();
    expectTypeOf<"both_incomplete">().toMatchTypeOf<MatchEndedReason>();
  });

  it("includes disconnect as a valid value", () => {
    expectTypeOf<"disconnect">().toMatchTypeOf<MatchEndedReason>();
  });

  it("includes forfeit as a valid value", () => {
    expectTypeOf<"forfeit">().toMatchTypeOf<MatchEndedReason>();
  });

  it("includes abandoned as a valid value", () => {
    expectTypeOf<"abandoned">().toMatchTypeOf<MatchEndedReason>();
  });
});
