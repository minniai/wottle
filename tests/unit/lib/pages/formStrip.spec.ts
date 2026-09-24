import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { formStrip } from "@/lib/pages/formStrip";

/** Spec 070 US2.1 (T048): the last ten, oldest first; the letter carries the meaning. */
describe("formStrip", () => {
  it("draws ten cells, oldest first, padded with empty ones", () => {
    const strip = formStrip(["W", "L", "W"], getCopy("en"));
    expect(strip.cells).toHaveLength(10);
    expect(strip.cells.slice(0, 3)).toEqual([
      { letter: "W", result: "W" },
      { letter: "L", result: "L" },
      { letter: "W", result: "W" },
    ]);
    expect(strip.cells[3]).toEqual({ letter: "", result: null });
    expect(strip.label).toBe("last ten: 2 won, 1 lost");
  });

  it("writes Icelandic letters, and names draws only when there are any", () => {
    const strip = formStrip(["W", "W", "L", "D"], getCopy("is"));
    expect(strip.cells.slice(0, 4).map((c) => c.letter)).toEqual(["S", "S", "T", "J"]);
    expect(strip.label).toBe("síðustu tíu: 2 sigrar, 1 tap, 1 jafntefli");
  });

  it("keeps only the last ten", () => {
    expect(formStrip(Array.from({ length: 12 }, () => "W" as const), getCopy("en")).cells).toHaveLength(10);
  });
});
