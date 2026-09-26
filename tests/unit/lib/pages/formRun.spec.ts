import { describe, expect, it } from "vitest";

import { getCopy } from "@/lib/i18n/getCopy";
import { FORM_RUN_MAX, formCellLabel, formRun, formRunSlots, formTipAnchor } from "@/lib/pages/formRun";
import type { FormGame } from "@/lib/types/standing";

const game = (n: number, result: FormGame["result"], opponent = "Kári"): FormGame => ({
  matchId: `m${n}`,
  result,
  opponent,
  you: 100 + n,
  them: 90,
  completedAt: "2026-09-24T12:00:00.000Z",
});

/** The lobby's form strip (2026-09-26): as many of your last matches as fit column A, oldest first. */
describe("formRunSlots", () => {
  it("fits 20px cells that share a 1px border, never more than the most kept", () => {
    expect(formRunSlots(584)).toBe(30);
    expect(formRunSlots(2000)).toBe(FORM_RUN_MAX);
    expect(formRunSlots(191)).toBe(10);
    expect(formRunSlots(190)).toBe(9);
  });

  it("keeps at least one cell", () => {
    expect(formRunSlots(0)).toBe(1);
  });
});

describe("formRun", () => {
  it("keeps the newest that fit, oldest first, padded with empty cells", () => {
    const games = [game(1, "W"), game(2, "L"), game(3, "D"), game(4, "W")];
    const run = formRun(games, 3, getCopy("en"));
    expect(run.cells.map((c) => c.game?.matchId)).toEqual(["m2", "m3", "m4"]);
    expect(run.cells.map((c) => c.letter)).toEqual(["L", "D", "W"]);
    const padded = formRun(games.slice(0, 1), 3, getCopy("is"));
    expect(padded.cells.map((c) => c.letter)).toEqual(["S", "", ""]);
    expect(padded.cells[1]).toEqual({ letter: "", result: null, game: null });
  });

  it("captions the count that fits and sums what it shows", () => {
    const games = [game(1, "W"), game(2, "L"), game(3, "D"), game(4, "W")];
    expect(formRun(games, 3, getCopy("en")).caption).toBe("last 3");
    expect(formRun(games, 30, getCopy("is")).caption).toBe("síðustu 30");
    expect(formRun(games, 3, getCopy("en")).label).toBe("last 3: 1 won, 1 lost, 1 drawn");
    expect(formRun(games, 30, getCopy("is")).label).toBe("síðustu 30: 2 sigrar, 1 tap, 1 jafntefli");
  });
});

describe("formCellLabel", () => {
  it("names the result, the opponent, the score and when, name-safe in both languages", () => {
    expect(formCellLabel(game(4, "L", "Strikki"), "yesterday", getCopy("en"))).toBe("loss · Strikki · 104–90 · yesterday");
    expect(formCellLabel(game(4, "W", "Strikki"), "í gær", getCopy("is"))).toBe("sigur · Strikki · 104–90 · í gær");
  });

  it("leaves the date out until the browser can say it in its own time zone", () => {
    expect(formCellLabel(game(4, "L", "Strikki"), null, getCopy("en"))).toBe("loss · Strikki · 104–90");
  });
});

describe("formTipAnchor", () => {
  it("opens the card inward so it never leaves the column", () => {
    expect(formTipAnchor(0, 30)).toBe("start");
    expect(formTipAnchor(14, 30)).toBe("start");
    expect(formTipAnchor(15, 30)).toBe("end");
    expect(formTipAnchor(29, 30)).toBe("end");
  });
});
