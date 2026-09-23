import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { SEATED_TABLE } from "@/lib/match/table";
import { readySlipModel, tableSlipFor, voidSlipModel, type TableSlipInput } from "@/lib/room/tableSlip";
import type { MatchState, PlayerMatchFacts } from "@/lib/types/match";

/** Spec 069 T014: the ready slip (C1), from the match state alone. */
const NOW = Date.parse("2026-09-23T12:00:06.000Z");
const facts = (playerId: string): PlayerMatchFacts => ({ playerId, movesPlayed: 0, score: 0, inFlight: null, lastResolution: null });

function match(over: Partial<MatchState> = {}, seats: { a: string | null; b: string | null } = { a: null, b: null }): MatchState {
  return {
    matchId: "m1", board: null, state: "pending",
    players: { playerA: facts("birna"), playerB: facts("kari") },
    clock: { startedAt: null, deadlineAt: null, serverNow: "2026-09-23T12:00:06.000Z" },
    moveLimit: 10, language: "en", resolvedSeq: 0, scores: { playerA: 0, playerB: 0 }, frozenTiles: {},
    table: { ...SEATED_TABLE, seats, deadlineAt: "2026-09-23T12:00:20.000Z", origin: "queue" },
    stakes: { birna: { win: 8, draw: 0, loss: -8 }, kari: { win: 8, draw: 0, loss: -8 } },
    ...over,
  };
}

function input(m: MatchState, over: Partial<TableSlipInput> = {}): TableSlipInput {
  return { match: m, viewerSlot: "player_a", you: { name: "Birna", rating: 1204 }, opp: { name: "Kári", rating: 1187 }, nowMs: NOW, copy: copyEn, ...over };
}

describe("readySlipModel (spec 069 C1)", () => {
  it("counts down the time to sit down and drains with it", () => {
    const model = readySlipModel(input(match()));
    expect(model.label).toBe("opponent found · 0:14");
    expect(model.drain).toBeCloseTo(14 / 20, 5);
  });

  it("names the opponent, the facts and the viewer's stakes", () => {
    const model = readySlipModel(input(match()));
    expect(model.headline).toEqual({ name: "Kári", rating: 1187 });
    expect(model.facts).toBe("english words · 10 moves each · one 5:00 clock");
    expect(model.stakes).toBe("win +8 · draw 0 · loss −8");
  });

  it("orders the seats opponent then you, each saying whether they sat down", () => {
    const model = readySlipModel(input(match({}, { a: null, b: "2026-09-23T12:00:01.000Z" })));
    expect(model.seats).toEqual([
      { seat: "opp", name: "Kári", status: "ready", seated: true },
      { seat: "you", name: "Birna · you", status: "on the way", seated: false },
    ]);
  });

  it("offers `ready ▸` to an unseated viewer and a wait once seated", () => {
    expect(readySlipModel(input(match())).actions).toBe("ready+leave");
    expect(readySlipModel(input(match({}, { a: "2026-09-23T12:00:01.000Z", b: null }))).actions).toBe("seated+leave");
  });

  it("once the start is set reads `starts in 3`, and offers nothing", () => {
    const started = match({ state: "in_progress", clock: { startedAt: "2026-09-23T12:00:10.000Z", deadlineAt: "2026-09-23T12:05:10.000Z", serverNow: "" } }, { a: "x", b: "y" });
    const model = readySlipModel(input(started));
    expect(model.label).toBe("starts in 3");
    expect(model.actions).toBe("none");
    expect(model.seats.every((s) => s.seated)).toBe(true);
    expect(model.drain).toBeNull();
  });

  it("leaves out the stakes when the server sent none", () => {
    expect(readySlipModel(input(match({ stakes: null }))).stakes).toBeNull();
  });

  it("speaks Icelandic", () => {
    const model = readySlipModel(input(match({ language: "is" }), { copy: copyIs }));
    expect(model.label).toBe("mótspilari fundinn · 0:14");
    expect(model.facts).toBe("íslensk orð · 10 leikir hvor · ein 5:00 klukka");
    expect(model.seats[1]).toMatchObject({ name: "Birna · þú", status: "á leiðinni" });
  });
});

describe("tableSlipFor (spec 069 FR-010)", () => {
  it("raises the ready slip while pending", () => {
    expect(tableSlipFor(input(match()))?.kind).toBe("ready");
  });

  it("keeps it up until 3.3s before go, then lifts it", () => {
    const at = (startsInMs: number) =>
      match({ state: "in_progress", clock: { startedAt: new Date(NOW + startsInMs).toISOString(), deadlineAt: new Date(NOW + startsInMs + 300_000).toISOString(), serverNow: "" } }, { a: "x", b: "y" });
    expect(tableSlipFor(input(at(4_000)))?.kind).toBe("ready");
    expect(tableSlipFor(input(at(3_300)))).toBeNull();
    expect(tableSlipFor(input(at(-1_000)))).toBeNull();
  });

  it("raises nothing for a live or finished match", () => {
    expect(tableSlipFor(input(match({ state: "completed", endedReason: "moves_complete" })))).toBeNull();
  });
});

/** Spec 069 T036: the void slip (C3). */
describe("voidSlipModel (spec 069 C3)", () => {
  const voided = (reason: "not_seated" | "left", voidedBy: string | null, origin: "queue" | "challenge" | "rematch", seats = { a: "x" as string | null, b: null as string | null }) =>
    match({ state: "completed", endedReason: "void", table: { ...SEATED_TABLE, seats, origin, voidReason: reason, voidedBy, rematchOf: origin === "rematch" ? "m0" : null } });

  it("names the opponent who did not sit down; a seated searcher is back in the queue", () => {
    const model = voidSlipModel(input(voided("not_seated", "kari", "queue")));
    expect(model).toEqual({
      label: "no match",
      headline: "Kári did not sit down",
      body: ["nothing was rated", "you are back in the queue"],
      actions: ["cancelQueue"],
      requeued: true,
    });
  });

  it("names the opponent who left", () => {
    expect(voidSlipModel(input(voided("left", "kari", "queue", { a: "x", b: "y" }))).headline).toBe("Kári left the table");
  });

  it("tells the viewer who did not sit down, who is not requeued", () => {
    const model = voidSlipModel(input(voided("not_seated", "birna", "queue", { a: null, b: "y" })));
    expect(model).toMatchObject({ headline: "You did not sit down in time", body: ["nothing was rated"], actions: ["lobby"], requeued: false });
  });

  it("when neither sat down, speaks to the viewer", () => {
    expect(voidSlipModel(input(voided("not_seated", null, "queue", { a: null, b: null }))).headline).toBe("You did not sit down in time");
  });

  it("offers `challenge again ▸` after a challenge, and the previous result after a rematch", () => {
    expect(voidSlipModel(input(voided("not_seated", "kari", "challenge"))).actions).toEqual(["challengeAgain", "lobby"]);
    expect(voidSlipModel(input(voided("not_seated", "kari", "rematch"))).actions).toEqual(["result", "lobby"]);
  });

  it("the viewer who left is told so", () => {
    expect(voidSlipModel(input(voided("left", "birna", "challenge"))).headline).toBe("You left the table");
  });

  it("speaks Icelandic", () => {
    const model = voidSlipModel(input(voided("not_seated", "kari", "queue"), { copy: copyIs }));
    expect(model).toMatchObject({ label: "engin viðureign", headline: "Kári settist ekki", body: ["hefur ekki áhrif á Elo stig", "þú ert aftur í leitinni"] });
  });

  it("tableSlipFor raises it for a void match", () => {
    expect(tableSlipFor(input(voided("left", "kari", "challenge")))?.kind).toBe("void");
  });
});
