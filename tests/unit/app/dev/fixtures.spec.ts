import { describe, expect, it } from "vitest";

import { FIXTURE_BOARD, FIXTURE_FROZEN, FIXTURE_WORDS } from "@/app/[locale]/dev/room/fixtures";
import { assertWordsSpellBoard } from "@/lib/room/wordIntegrity";

/** The fixture may never carry the bug it exists to catch (spec 047 T006). */
describe("room fixture integrity", () => {
  it("every fixture word spells its run on the fixture board", () => {
    expect(assertWordsSpellBoard(FIXTURE_BOARD, FIXTURE_WORDS)).toEqual([]);
  });

  it("every coordinate of every fixture word is frozen", () => {
    for (const w of FIXTURE_WORDS) {
      for (const c of w.coordinates) {
        expect(FIXTURE_FROZEN, `${w.word} at ${c.x},${c.y}`).toHaveProperty(`${c.x},${c.y}`);
      }
    }
  });
});
