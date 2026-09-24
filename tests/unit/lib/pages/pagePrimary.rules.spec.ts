import { describe, expect, it } from "vitest";

import { matchPathParam } from "@/lib/auth/nextParam";
import { copyEn } from "@/lib/i18n/copy/en";
import { rulesPrimary } from "@/lib/pages/pagePrimary";
import type { SlotState } from "@/lib/pages/standingSlot";

const EMPTY: SlotState = { kind: "empty" };
const MATCH = "/match/0b8f2a1c-3d4e-4f5a-8b6c-7d8e9f0a1b2c";

/** Spec 072 T081 (FR-061): the rules page's primary, chosen by how you came. */
describe("rulesPrimary", () => {
  it("closes the tab when opened from a match", () => {
    expect(rulesPrimary(EMPTY, copyEn, { signedIn: true, from: MATCH })).toEqual({ kind: "closeTab", label: "close this tab ▸", back: MATCH });
  });

  it("offers find an opponent to a signed-in player with nothing standing", () => {
    expect(rulesPrimary(EMPTY, copyEn, { signedIn: true, from: null })).toEqual({ kind: "find", label: copyEn.FIND_OPPONENT });
  });

  it("offers the lobby to a visitor", () => {
    expect(rulesPrimary(EMPTY, copyEn, { signedIn: false, from: null })).toEqual({ kind: "enterLobby", label: copyEn.ENTER_LOBBY });
  });

  it("gives way to a call, whose accept is the primary", () => {
    const call = { kind: "call" } as SlotState;
    expect(rulesPrimary(call, copyEn, { signedIn: true, from: MATCH })).toEqual({ kind: "none" });
  });
});

describe("matchPathParam", () => {
  it("accepts only a same-origin match path, in either locale", () => {
    expect(matchPathParam(MATCH)).toBe(MATCH);
    expect(matchPathParam(`/en${MATCH}`)).toBe(`/en${MATCH}`);
    for (const bad of ["/profile", "https://evil.test/match/x", "//evil.test", "/match/not-a-uuid", "/en/match/../rules", null, undefined]) {
      expect(matchPathParam(bad)).toBeNull();
    }
  });
});
