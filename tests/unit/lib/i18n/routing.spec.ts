import { describe, expect, test } from "vitest";

import { decideLocaleRoute } from "@/lib/i18n/routing";

describe("decideLocaleRoute", () => {
  test("rewrites unprefixed paths to the Icelandic segment", () => {
    expect(decideLocaleRoute("/")).toEqual({ kind: "rewrite", to: "/is" });
    expect(decideLocaleRoute("/lobby")).toEqual({ kind: "rewrite", to: "/is/lobby" });
    expect(decideLocaleRoute("/match/abc")).toEqual({ kind: "rewrite", to: "/is/match/abc" });
  });

  test("redirects /is to the unprefixed path", () => {
    expect(decideLocaleRoute("/is")).toEqual({ kind: "redirect", to: "/", status: 308 });
    expect(decideLocaleRoute("/is/match/abc")).toEqual({
      kind: "redirect",
      to: "/match/abc",
      status: 308,
    });
  });

  test("passes registered non-default prefixes through", () => {
    expect(decideLocaleRoute("/en")).toEqual({ kind: "next" });
    expect(decideLocaleRoute("/en/lobby")).toEqual({ kind: "next" });
  });

  test("does not mistake a path that merely starts with a locale id", () => {
    expect(decideLocaleRoute("/english")).toEqual({ kind: "rewrite", to: "/is/english" });
    expect(decideLocaleRoute("/island")).toEqual({ kind: "rewrite", to: "/is/island" });
  });

  test("an unknown prefix becomes an Icelandic path that does not exist", () => {
    expect(decideLocaleRoute("/xx/lobby")).toEqual({ kind: "rewrite", to: "/is/xx/lobby" });
  });
});
