import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";

/** Spec 069 US8 (game flow C6): the resign slip names what resigning costs, from the table's stakes. */
describe("resignConsequence", () => {
  it("ends with the loss stake when the room knows it", () => {
    expect(copyEn.resignConsequence("Kári", -9)).toBe("Kári wins · your rating moves as a loss · −9");
    expect(copyIs.resignConsequence("Kári", -9)).toBe("Kári vinnur · Elo-stigin þín reiknast sem tap · −9");
  });

  it("says no number when it does not (a reload mid-match)", () => {
    expect(copyEn.resignConsequence("Kári")).toBe("Kári wins · your rating moves as a loss");
  });
});
