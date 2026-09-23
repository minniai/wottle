import { describe, expect, it } from "vitest";

import { copyEn } from "@/lib/i18n/copy/en";
import { SEATED_TABLE } from "@/lib/match/table";
import { deriveMoveState, liveLinesFor, turnFrameFor } from "@/lib/room/moveState";
import type { MatchState, PlayerMatchFacts } from "@/lib/types/match";

/** Spec 069 T013: the table and the void are beats before `starting`. */
const facts = (playerId: string): PlayerMatchFacts => ({ playerId, movesPlayed: 0, score: 0, inFlight: null, lastResolution: null });

function match(over: Partial<MatchState> = {}): MatchState {
  return {
    matchId: "m1", board: null, state: "pending",
    players: { playerA: facts("you"), playerB: facts("opp") },
    clock: { startedAt: null, deadlineAt: null, serverNow: "2026-09-23T12:00:00.000Z" },
    moveLimit: 10, language: "en", resolvedSeq: 0, scores: { playerA: 0, playerB: 0 }, frozenTiles: {},
    table: { ...SEATED_TABLE, seats: { a: null, b: null } }, stakes: null,
    ...over,
  };
}

const derive = (m: MatchState, msToStart = 0) =>
  deriveMoveState({ match: m, viewerSlot: "player_a", opponentName: "Kári", holdMove: null, revealingOwn: false, rejected: null, clockMs: 300_000, msToStart });

describe("the table's beats (spec 069)", () => {
  it("a pending match is the table, never `your move`", () => {
    expect(derive(match())).toEqual({ kind: "table", opponentName: "Kári" });
  });

  it("a void match is the void, before anything else", () => {
    const voided = match({ state: "completed", endedReason: "void", table: { ...SEATED_TABLE, voidReason: "not_seated", voidedBy: "opp" } });
    expect(derive(voided)).toEqual({ kind: "void", opponentName: "Kári" });
  });

  it("neither frames the field nor writes a live row", () => {
    for (const state of [derive(match()), { kind: "void" as const, opponentName: "Kári" }]) {
      expect(turnFrameFor(state)).toBeNull();
      expect(liveLinesFor(state, { kind: "idle" }, copyEn)).toEqual({ line1: "", line2: "" });
    }
  });
});
