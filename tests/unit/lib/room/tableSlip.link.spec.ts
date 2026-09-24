import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { copyIs } from "@/lib/i18n/copy/is";
import { SEATED_TABLE } from "@/lib/match/table";
import { readySlipModel, voidSlipModel, type TableSlipInput } from "@/lib/room/tableSlip";
import type { MatchState, PlayerMatchFacts } from "@/lib/types/match";

/** Spec 072 T049: a link table waits for its sender until the link would have expired. */
const NOW = Date.parse("2026-09-24T12:00:00.000Z");
const facts = (playerId: string): PlayerMatchFacts => ({ playerId, movesPlayed: 0, score: 0, inFlight: null, lastResolution: null });

function linkTable(seats: { a: string | null; b: string | null }, over: Partial<MatchState["table"]> = {}): MatchState {
  return {
    matchId: "m1", board: null, state: "pending",
    players: { playerA: facts("embla"), playerB: facts("kari") },
    clock: { startedAt: null, deadlineAt: null, serverNow: new Date(NOW).toISOString() },
    moveLimit: 10, language: "en", resolvedSeq: 0, scores: { playerA: 0, playerB: 0 }, frozenTiles: {},
    table: { ...SEATED_TABLE, seats, deadlineAt: new Date(NOW + 552_000).toISOString(), origin: "link", ...over },
    stakes: null,
  } as MatchState;
}

const input = (m: MatchState, copy: TableSlipInput["copy"] = copyEn): TableSlipInput => ({ match: m, viewerSlot: "player_a", you: { name: "Embla", rating: 1200 }, opp: { name: "Kári", rating: 1265 }, nowMs: NOW, copy });

describe("readySlipModel · link tables", () => {
  it("says the table waits while the sender is away, to the link's time, and drains over the link's life", () => {
    const m = readySlipModel(input(linkTable({ a: "2026-09-24T11:59:00Z", b: null })));
    expect(m.label).toBe("the table waits · 9:12");
    expect(m.drain).toBeCloseTo(552 / 600, 5);
    expect(readySlipModel(input(linkTable({ a: "2026-09-24T11:59:00Z", b: null }), copyIs)).label).toBe("borðið bíður · 9:12");
  });

  it("reads as any table once the sender is seated, or for the sender", () => {
    expect(readySlipModel(input(linkTable({ a: null, b: "2026-09-24T11:59:00Z" }))).label).toBe("opponent found · 9:12");
  });
});

describe("voidSlipModel · link tables", () => {
  it("names the sender who did not sit down after the friend left (Q1)", () => {
    const m = voidSlipModel(input({ ...linkTable({ a: "2026-09-24T11:59:00Z", b: null }), state: "completed", endedReason: "void", table: { ...linkTable({ a: "x", b: null }).table, voidReason: "not_seated", voidedBy: "kari" } } as MatchState));
    expect(m.headline).toBe(copyEn.table.voidOppNotSeated("Kári"));
    expect(m.actions).toEqual(["lobby"]);
  });
});
