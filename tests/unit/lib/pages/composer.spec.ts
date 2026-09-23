import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { composerModel } from "@/lib/pages/composer";

const viewer = { rating: 1310, gamesPlayed: 22 };
const embla = { rating: 1342 };

/** Spec 070 US3.1 (T063): the composer states the terms and your stakes before you send. */
describe("composerModel", () => {
  it("writes the terms and the stakes on one line on a desktop", () => {
    const m = composerModel({ viewer, opponent: embla, searching: false, outgoing: false, callUp: false }, getCopy("en"), "desktop");
    expect(m.terms).toEqual([
      expect.stringMatching(/^every match rated · win \+\d+ · draw [+−]?\d+ · loss −\d+ · english words · 10 moves each · one 5:00 clock$/),
    ]);
    expect(m.consequence).toBeNull();
    expect(m.sendDrawnAs).toBe("primary");
  });

  it("splits them over two lines on a phone, in Icelandic", () => {
    const m = composerModel({ viewer, opponent: embla, searching: false, outgoing: false, callUp: false }, getCopy("is"), "phone");
    expect(m.terms[0]).toBe("gildir til elo · íslensk orð · 10 leikir hvor");
    expect(m.terms[1]).toMatch(/^sigur \+\d+ · jafntefli [+−]?\d+ · tap −\d+$/);
  });

  it("says what sending cancels: the search first, else the other challenge", () => {
    const en = getCopy("en");
    expect(composerModel({ viewer, opponent: embla, searching: true, outgoing: true, callUp: false }, en, "desktop").consequence).toBe("sending cancels your search");
    expect(composerModel({ viewer, opponent: embla, searching: false, outgoing: true, callUp: false }, en, "desktop").consequence).toBe("sending withdraws your other challenge");
  });

  it("draws send as a secondary while a call is up (the call outranks it)", () => {
    expect(composerModel({ viewer, opponent: embla, searching: false, outgoing: false, callUp: true }, getCopy("en"), "desktop").sendDrawnAs).toBe("secondary");
  });

  it("uses the settlement's own stakes: a higher-rated opponent is worth more to beat", () => {
    const up = composerModel({ viewer, opponent: { rating: 1500 }, searching: false, outgoing: false, callUp: false }, getCopy("en"), "desktop");
    const down = composerModel({ viewer, opponent: { rating: 1100 }, searching: false, outgoing: false, callUp: false }, getCopy("en"), "desktop");
    const win = (s: string) => Number(/win \+(\d+)/.exec(s)![1]);
    expect(win(up.terms[0])).toBeGreaterThan(win(down.terms[0]));
  });
});
