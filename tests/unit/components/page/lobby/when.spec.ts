import { describe, expect, it } from "vitest";

import { whenWord } from "@/components/page/lobby/when";
import { getCopy } from "@/lib/i18n/getCopy";

const NOW = new Date(2026, 8, 26, 13, 0).getTime();
const at = (month: number, day: number) => new Date(2026, month, day, 12, 0).toISOString();

/** `today`, `yesterday`, or a short date written by the copy, never by the browser's locale data (2026-09-26). */
describe("whenWord", () => {
  it("says today and yesterday", () => {
    expect(whenWord(at(8, 26), NOW, getCopy("en"))).toBe("today");
    expect(whenWord(at(8, 25), NOW, getCopy("is"))).toBe("í gær");
  });

  it("writes an older date in the page's language, the same on the server and in any browser", () => {
    expect(whenWord(at(7, 28), NOW, getCopy("en"))).toBe("Aug 28");
    expect(whenWord(at(7, 28), NOW, getCopy("is"))).toBe("28. ágú.");
    expect(whenWord(at(4, 3), NOW, getCopy("is"))).toBe("3. maí");
  });
});
