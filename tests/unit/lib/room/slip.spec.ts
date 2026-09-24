import { beforeEach, describe, expect, it } from "vitest";

import { useRoomStore } from "@/lib/room/roomStore";
import { outranks, slipPrecedence, type SlipState } from "@/lib/room/slip";
import type { MatchState, PlayerIdentity } from "@/lib/types/match";
import { SEATED_TABLE } from "@/lib/match/table";

const BIRNA: PlayerIdentity = { id: "you", username: "birna", displayName: "Birna" } as PlayerIdentity;
const RESIGN: SlipState = { kind: "resign", move: 4, clockMs: 192_000, opponentName: "Kári" };
const CLAIM: SlipState = { kind: "endEarly", opponentName: "Kári", opponentMoves: 8, clockMs: 72_000 };
const OVER: SlipState = {
  kind: "matchOver",
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points · 10 words to 8 · territory 32–25" },
  durationMmSs: "4:52",
  scores: { you: 127, opp: 170 },
  viewerName: "Birna",
  opponentName: "Kári",
  ratings: [],
  rematch: null,
  readOnly: false,
};

function matchState(matchId: string): MatchState {
  const facts = (playerId: string) => ({ playerId, movesPlayed: 0, score: 0, inFlight: null, lastResolution: null });
  return {
    matchId,
    board: [],
    state: "in_progress",
    players: { playerA: facts("you"), playerB: facts("opp") },
    clock: { startedAt: null, deadlineAt: null, serverNow: "2026-01-01T00:00:00Z" },
    moveLimit: 10,
    language: "is",
    resolvedSeq: 0,
    scores: { playerA: 0, playerB: 0 },
    frozenTiles: {},
    table: SEATED_TABLE,
    stakes: null,
  };
}

describe("slip precedence (spec 048 contracts/slip.md)", () => {
  it("ranks matchOver > endEarly > resign > ready (the sign-in slip is retired, spec 070)", () => {
    expect(slipPrecedence("matchOver")).toBeGreaterThan(slipPrecedence("endEarly"));
    expect(slipPrecedence("endEarly")).toBeGreaterThan(slipPrecedence("resign"));
    expect(slipPrecedence("resign")).toBeGreaterThan(slipPrecedence("ready"));
  });

  it("outranks only when the current slip is strictly higher", () => {
    expect(outranks(null, RESIGN)).toBe(false);
    expect(outranks(OVER, RESIGN)).toBe(true);
    expect(outranks(RESIGN, RESIGN)).toBe(false);
    expect(outranks(RESIGN, CLAIM)).toBe(false);
  });
});

describe("roomStore slip", () => {
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    useRoomStore.setState({ viewer: null, slip: null, slipDismissed: false });
  });

  it("setSlip keeps a higher-ranked slip and replaces a lower one", () => {
    const s = useRoomStore.getState;
    s().setSlip(OVER);
    s().setSlip(RESIGN);
    expect(s().slip?.kind).toBe("matchOver");
    s().clearSlip("matchOver");
    s().setSlip(RESIGN);
    s().setSlip(CLAIM);
    expect(s().slip?.kind).toBe("endEarly");
  });

  it("clearSlip clears only its own kind", () => {
    const s = useRoomStore.getState;
    s().setSlip(CLAIM);
    s().clearSlip("resign");
    expect(s().slip?.kind).toBe("endEarly");
    s().clearSlip("endEarly");
    expect(s().slip).toBeNull();
  });

  it("dismiss and restore hide the match-over slip without losing it", () => {
    const s = useRoomStore.getState;
    s().setSlip(OVER);
    s().dismissSlip();
    expect(s().slipDismissed).toBe(true);
    expect(s().slip?.kind).toBe("matchOver");
    s().restoreSlip();
    expect(s().slipDismissed).toBe(false);
    // Ratings arriving update the same slip without re-showing a reviewed result.
    s().dismissSlip();
    s().setSlip({ ...OVER, rematch: "waiting" });
    expect(s().slipDismissed).toBe(true);
    expect(s().slip).toMatchObject({ kind: "matchOver", rematch: "waiting" });
  });

  it("hydrating another match resets the slip, the dismissal and the hold", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState("m1"), "you");
    s().setSlip(OVER);
    s().dismissSlip();
    s().beginHold(3);
    s().hydrateMatch(matchState("m2"), "you");
    expect(s().slip).toBeNull();
    expect(s().slipDismissed).toBe(false);
    expect(s().holdMove).toBeNull();
    // Re-hydrating the same match (a poll) keeps them.
    s().setSlip(OVER);
    s().beginHold(3);
    s().hydrateMatch(matchState("m2"), "you");
    expect(s().slip?.kind).toBe("matchOver");
    expect(s().holdMove).toBe(3);
  });
});
