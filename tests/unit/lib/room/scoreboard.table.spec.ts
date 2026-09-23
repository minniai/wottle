import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { deriveScoreboard, type ScoreboardInput } from "@/lib/room/scoreboard";

/** Spec 069 T015: the scoreboard at the table and at the void (canvas Table, Void). */
function input(over: Partial<ScoreboardInput> = {}): ScoreboardInput {
  return {
    phase: "table",
    moveState: null,
    remainingMs: 300_000,
    clockLengthMs: 300_000,
    moveLimit: 10,
    readOnly: false,
    you: { name: "Birna", rating: 1204, movesPlayed: 0, inFlight: false, score: 0 },
    opp: { name: "Kári", rating: 1187, movesPlayed: 0, inFlight: false, score: 0 },
    table: { youSeated: false, oppSeated: false },
    ...over,
  };
}

describe("the scoreboard at the table (spec 069)", () => {
  it("holds a full clock that does not run and says when it starts", () => {
    const { clock } = deriveScoreboard(input(), copyEn);
    expect(clock).toMatchObject({ phase: "table", label: "match clock", detail: "starts when both sit", numeral: "5:00", ticksLeft: 60 });
  });

  it("names the seats and whether each player has sat down, with no totals", () => {
    const view = deriveScoreboard(input({ table: { youSeated: true, oppSeated: false } }), copyEn);
    expect(view.opp).toMatchObject({ muted: "1187 · opponent", suffix: "on the way", showTotal: false });
    expect(view.you).toMatchObject({ muted: "1204 · you", suffix: "ready", showTotal: false });
    expect(deriveScoreboard(input(), copyEn).you.suffix).toBe("not ready");
  });

  it("speaks Icelandic", () => {
    const view = deriveScoreboard(input({ table: { youSeated: false, oppSeated: true } }), copyIs);
    expect(view.clock).toMatchObject({ label: "leikklukka", detail: "fer af stað þegar báðir sitja" });
    expect(view.opp).toMatchObject({ muted: "1187 · mótspilari", suffix: "við borðið" });
    expect(view.you).toMatchObject({ muted: "1204 · þú", suffix: "á leiðinni" });
  });

  it("on a phone, the rows carry the seat status alone", () => {
    const view = deriveScoreboard(input({ compact: true, table: { youSeated: false, oppSeated: true } }), copyIs);
    expect(view.opp).toMatchObject({ muted: "", suffix: "við borðið" });
    expect(view.you).toMatchObject({ muted: "", suffix: "á leiðinni" });
  });
});

describe("the scoreboard at the void (spec 069)", () => {
  it("says the clock never started, who did not sit down, and that the viewer is searching again", () => {
    const view = deriveScoreboard(input({ phase: "void", table: { youSeated: true, oppSeated: false, oppVoid: "notSeated", youRequeued: true } }), copyEn);
    expect(view.clock).toMatchObject({ phase: "void", label: "match clock", detail: "not started", numeral: "5:00" });
    expect(view.opp).toMatchObject({ muted: "1187", suffix: "did not sit down", showTotal: false });
    expect(view.you).toMatchObject({ muted: "1204 · you", suffix: "searching" });
  });

  it("says the opponent left", () => {
    const view = deriveScoreboard(input({ phase: "void", table: { youSeated: true, oppSeated: true, oppVoid: "left" } }), copyEn);
    expect(view.opp.suffix).toBe("left");
    expect(view.you.suffix).toBeNull();
  });
});
