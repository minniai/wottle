import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { buildReviewSteps } from "@/lib/review/buildReviewSteps";
import { cursorLines } from "@/lib/review/cursorLines";
import { timeoutPenalty } from "@/lib/scoring/missPenalty";

import { movesResponse, rowsFrom } from "./reviewFixtures";

const NAMES = { a: "Birna", b: "Kári" };

function steps() {
  const rows = rowsFrom([
    { slot: "player_a", at: 10, points: 33, freezes: 6 },
    { slot: "player_b", at: 20, points: 12, freezes: 3 },
    { slot: "player_b", at: 25 },
    { slot: "player_b", at: 30, refused: true },
    { slot: "player_a", at: 40, points: 12, freezes: 3 },
  ]);
  rows[0].words = [
    { ...rows[0].words[0], word: "lek", totalPoints: 13 },
    { ...rows[0].words[0], word: "æsku", totalPoints: 20 },
  ];
  const tail = rows[rows.length - 1].scoreAfter;
  return buildReviewSteps(movesResponse(rows, "incomplete", { a: tail.a + timeoutPenalty(tail.a, 8), b: tail.b + timeoutPenalty(tail.b, 8) }));
}

describe("cursorLines (spec 071 FR-037)", () => {
  const all = steps();

  it("names the move, the mover and the words, then what froze and who leads", () => {
    expect(cursorLines(all[0], NAMES, copyEn)).toEqual({ line1: "move 1 · Birna · LEK · ÆSKU +33", line2: "froze 6 · Birna leads 33–0" });
    expect(cursorLines(all[0], NAMES, copyIs)).toEqual({ line1: "leikur 1 · Birna · LEK · ÆSKU +33", line2: "6 frosnir · Birna leiðir 33–0" });
  });

  it("says a miss and a refusal", () => {
    expect(cursorLines(all[2], NAMES, copyEn)).toEqual({ line1: "move 2 · Kári · no word −5", line2: "Birna leads 33–7" });
    expect(cursorLines(all[3], NAMES, copyEn)).toEqual({ line1: "move 3 · Kári · refused", line2: "refused · frozen" });
    // A miss floored at 0 costs nothing and says no number.
    expect(cursorLines({ ...all[2], points: 0 }, NAMES, copyEn).line1).toBe("move 2 · Kári · no word");
    expect(cursorLines(all[3], NAMES, copyIs).line2).toBe("hafnað · frosinn");
  });

  it("closes on the unplayed moves, and says when it is level", () => {
    expect(cursorLines(all[5], NAMES, copyEn).line1).toBe("time · −47 not played");
    const level = { ...all[1], totals: { a: 12, b: 12 } };
    expect(cursorLines(level, NAMES, copyEn).line2).toBe("froze 3 · level 12–12");
  });

  it("fits the live row: about 40 mono characters a line", () => {
    for (const step of all) {
      for (const copy of [copyEn, copyIs]) {
        const { line1, line2 } = cursorLines(step, NAMES, copy);
        expect(line1.length).toBeLessThanOrEqual(44);
        expect(line2.length).toBeLessThanOrEqual(44);
      }
    }
  });
});
