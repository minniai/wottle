import { describe, expect, it } from "vitest";

import { checkName } from "@/lib/names/nameRule";

/** The door's name rule, one source for the form and the server. */
describe("checkName", () => {
  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["ab", "short"],
    ["a".repeat(25), "long"],
    ["ari jo", "chars"],
    ["ari!", "chars"],
    ["a b", "chars"],
    ["abc", "ok"],
    ["Drekkóo", "ok"],
    ["Þórður_Æ-9", "ok"],
    ["  birna  ", "ok"],
    ["a".repeat(24), "ok"],
  ])("reads %j as %s", (raw, verdict) => {
    expect(checkName(raw)).toBe(verdict);
  });

  it("names a bad character before a bad length", () => {
    expect(checkName("a b")).toBe("chars");
    expect(checkName(`${"a".repeat(24)} b`)).toBe("chars");
  });
});
