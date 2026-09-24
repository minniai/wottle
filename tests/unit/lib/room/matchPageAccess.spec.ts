import { describe, expect, it } from "vitest";

import { matchPageAccess, type MatchPageFacts } from "@/lib/room/matchPageAccess";

const MATCH = { state: "completed", endedReason: "moves_complete", language: "en" } as const;
const BASE: MatchPageFacts = {
  locale: "en",
  matchId: "m1",
  search: "?review=5",
  signedIn: true,
  participant: true,
  match: MATCH,
};
const at = (over: Partial<MatchPageFacts>) => matchPageAccess({ ...BASE, ...over });

describe("matchPageAccess (spec 071 FR-041, FR-042, T060, T064)", () => {
  it("renders the match for its players", () => {
    expect(at({})).toEqual({ kind: "render", readOnly: false });
    expect(at({ match: { ...MATCH, state: "in_progress", endedReason: null } })).toEqual({ kind: "render", readOnly: false });
  });

  it("lets anyone read a finished match, signed in or not", () => {
    expect(at({ participant: false })).toEqual({ kind: "render", readOnly: true });
    expect(at({ signedIn: false, participant: false })).toEqual({ kind: "render", readOnly: true });
  });

  it("sends a stranger away from a live match, and a visitor to the door with the way back", () => {
    const live = { ...MATCH, state: "in_progress" as const, endedReason: null };
    expect(at({ participant: false, match: live })).toEqual({ kind: "redirect", to: "/en" });
    expect(at({ signedIn: false, participant: false, match: live })).toEqual({ kind: "redirect", to: `/en/?next=${encodeURIComponent("/en/match/m1?review=5")}` });
  });

  it("has nothing to read for a void table", () => {
    const voided = { ...MATCH, endedReason: "void" as const };
    expect(at({ participant: false, match: voided })).toEqual({ kind: "redirect", to: "/en" });
    expect(at({ signedIn: false, participant: false, match: voided })).toEqual({ kind: "redirect", to: "/en" });
  });

  it("opens a match in its own language, keeping the query", () => {
    expect(at({ locale: "is" })).toEqual({ kind: "redirect", to: "/en/match/m1?review=5" });
    expect(at({ locale: "en", match: { ...MATCH, language: "is" } })).toEqual({ kind: "redirect", to: "/match/m1?review=5" });
  });

  it("sends a missing match to the lobby's notice", () => {
    expect(at({ match: null })).toEqual({ kind: "redirect", to: "/en/?notice=no-match&match=m1" });
    expect(at({ match: null, signedIn: false, participant: false })).toEqual({ kind: "redirect", to: `/en/?next=${encodeURIComponent("/en/match/m1?review=5")}` });
  });
});
