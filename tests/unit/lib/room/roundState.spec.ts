import { describe, expect, it } from "vitest";

import { barSublineFor, deriveRoundState, liveLinesFor, turnFrameFor, type RoundState } from "@/lib/room/roundState";
import type { MatchState } from "@/lib/types/match";

const K = "Kári";
function match(overrides: Partial<MatchState> = {}, timers: Partial<{ you: Partial<MatchState["timers"]["playerA"]>; opp: Partial<MatchState["timers"]["playerB"]> }> = {}): MatchState {
  return {
    matchId: "m1",
    board: [],
    currentRound: 4,
    state: "collecting",
    timers: {
      playerA: { playerId: "you", remainingMs: 252_000, status: "running", ...timers.you },
      playerB: { playerId: "opp", remainingMs: 151_000, status: "running", ...timers.opp },
    },
    scores: { playerA: 46, playerB: 15 },
    ...overrides,
  };
}
const derive = (m: MatchState, extra: Partial<{ holdRound: number | null; revealing: boolean }> = {}) =>
  deriveRoundState({ match: m, viewerSlot: "player_a", opponentName: K, holdRound: null, revealing: false, ...extra });

describe("deriveRoundState (spec 048 contracts/round-state.md)", () => {
  it("your move when both clocks run", () => {
    expect(derive(match())).toMatchObject({ kind: "yourMove", round: 4, opponentName: K });
  });
  it("opponent played when their clock is paused and yours runs", () => {
    expect(derive(match({}, { opp: { status: "paused" } }))).toMatchObject({ kind: "oppPlayed" });
  });
  it("played when your clock is paused", () => {
    expect(derive(match({}, { you: { status: "paused" }, opp: { status: "paused" } }))).toMatchObject({ kind: "played" });
  });
  it("out of time when your clock is spent and not paused", () => {
    expect(derive(match({}, { you: { remainingMs: 0 } }))).toMatchObject({ kind: "outOfTime" });
  });
  it("resolving while the server resolves or a reveal draws", () => {
    expect(derive(match({ state: "resolving" }))).toMatchObject({ kind: "resolving", round: 4 });
    expect(derive(match(), { revealing: true })).toMatchObject({ kind: "resolving" });
  });
  it("the bands come first: resolving while they draw, scored for the pause after", () => {
    const m = match({
      currentRound: 5,
      state: "resolving",
      lastSummary: { matchId: "m1", roundNumber: 4, words: [], deltas: { playerA: 12, playerB: 0 }, totals: { playerA: 58, playerB: 15 }, highlights: [], moves: [], resolvedAt: "" },
    });
    expect(derive(m, { holdRound: 4, revealing: true })).toMatchObject({ kind: "resolving" });
    expect(derive(m, { holdRound: 4, revealing: false })).toEqual({ kind: "scored", round: 4, next: 5, you: 12, opp: 0, opponentName: K });
  });
  it("a stale hold (not the previous round) is ignored", () => {
    expect(derive(match({ currentRound: 6 }), { holdRound: 3 })).toMatchObject({ kind: "yourMove" });
  });
  it("seat-relative: player B reads its own timer", () => {
    const m = match({}, { opp: { status: "paused" } });
    expect(deriveRoundState({ match: m, viewerSlot: "player_b", opponentName: "Birna", holdRound: null, revealing: false })).toMatchObject({ kind: "played" });
  });
});

describe("liveLinesFor", () => {
  const yourMove: RoundState = { kind: "yourMove", round: 4, opponentName: K };
  it("your move: the round on line 1, the field instruction on line 2", () => {
    expect(liveLinesFor(yourMove, { kind: "idle" })).toEqual({ line1: "round 4 · your move", line2: "pick a letter" });
    expect(liveLinesFor(yourMove, { kind: "picking", letter: "T", value: 2 })).toEqual({ line1: "round 4 · your move", line2: "picking · T (2) · tap a second letter" });
    expect(liveLinesFor(yourMove, { kind: "previewing", total: 24, words: ["hestur"] })).toEqual({ line1: "round 4 · your move", line2: "24 · hestur · tap again to play · esc cancels" });
    expect(liveLinesFor(yourMove, { kind: "illegal", ownerName: K, round: 2 })).toEqual({ line1: "round 4 · your move", line2: "frozen · Kári R2 · pick another" });
  });
  it("a commit in flight already reads played", () => {
    expect(liveLinesFor(yourMove, { kind: "played" })).toEqual({ line1: "played · waiting for Kári", line2: "Kári is thinking · their clock runs" });
  });
  it("the other beats carry their fact on line 2", () => {
    expect(liveLinesFor({ kind: "played", round: 4, opponentName: K }, { kind: "idle" })).toEqual({ line1: "played · waiting for Kári", line2: "Kári is thinking · their clock runs" });
    expect(liveLinesFor({ kind: "resolving", round: 4, opponentName: K }, { kind: "idle" })).toEqual({ line1: "resolving round 4", line2: "both played · scoring" });
    expect(liveLinesFor({ kind: "scored", round: 4, next: 5, you: 12, opp: 0, opponentName: K }, { kind: "idle" })).toEqual({ line1: "round 4 scored", line2: "you +12 · Kári +0 · round 5 opens in 1" });
    expect(liveLinesFor({ kind: "outOfTime", round: 4, opponentName: K }, { kind: "idle" })).toEqual({ line1: "out of time · waiting for Kári", line2: "your clock is spent · rounds pass" });
  });
});

describe("barSublineFor / turnFrameFor", () => {
  const base = "1204 · you";
  const cases: [RoundState["kind"], string | null, string | null, "you" | null][] = [
    ["yourMove", "your move", "thinking", "you"],
    ["oppPlayed", "your move", "played ●", "you"],
    ["played", "played ●", "thinking", null],
    ["resolving", null, null, null],
    ["scored", null, null, null],
    ["outOfTime", "0:00", "thinking", null],
  ];
  it.each(cases)("%s → you %s · opp %s · frame %s", (kind, you, opp, frame) => {
    const state = { kind, round: 4, opponentName: K, you: 0, opp: 0, next: 5 } as RoundState;
    expect(barSublineFor(base, state, "you")).toBe(you ? `${base} · ${you}` : base);
    expect(barSublineFor("1187 · opponent", state, "opp")).toBe(opp ? `1187 · opponent · ${opp}` : "1187 · opponent");
    expect(turnFrameFor(state)).toBe(frame);
  });
});
