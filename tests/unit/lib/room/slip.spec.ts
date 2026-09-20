import { beforeEach, describe, expect, it } from "vitest";

import { useRoomStore } from "@/lib/room/roomStore";
import { outranks, slipPrecedence, type SlipState } from "@/lib/room/slip";
import type { MatchState, PlayerIdentity } from "@/lib/types/match";

const BIRNA: PlayerIdentity = { id: "you", username: "birna", displayName: "Birna" } as PlayerIdentity;
const RESIGN: SlipState = { kind: "resign", round: 4, clockMs: 252_000, opponentName: "Kári" };
const CLAIM: SlipState = { kind: "claimWin", opponentName: "Kári", round: 4 };
const OVER: SlipState = {
  kind: "matchOver",
  verdict: { winnerSeat: "opp", scoreLine: "Kári wins 170–127", detailLine: "by 43 points · 10 words to 8 · territory 32–25" },
  rounds: 10,
  durationMmSs: "18:50",
  scores: { you: 127, opp: 170 },
  viewerName: "Birna",
  opponentName: "Kári",
  ratings: [],
  rematch: "idle",
  readOnly: false,
};

function matchState(matchId: string): MatchState {
  return {
    matchId,
    board: [],
    currentRound: 1,
    state: "collecting",
    timers: {
      playerA: { playerId: "you", remainingMs: 300_000, status: "running" },
      playerB: { playerId: "opp", remainingMs: 300_000, status: "running" },
    },
    scores: { playerA: 0, playerB: 0 },
  };
}

describe("slip precedence (spec 048 contracts/slip.md)", () => {
  it("ranks matchOver > claimWin > resign > signIn", () => {
    expect(slipPrecedence("matchOver")).toBeGreaterThan(slipPrecedence("claimWin"));
    expect(slipPrecedence("claimWin")).toBeGreaterThan(slipPrecedence("resign"));
    expect(slipPrecedence("resign")).toBeGreaterThan(slipPrecedence("signIn"));
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
    expect(s().slip?.kind).toBe("claimWin");
  });

  it("clearSlip clears only its own kind", () => {
    const s = useRoomStore.getState;
    s().setSlip(CLAIM);
    s().clearSlip("resign");
    expect(s().slip?.kind).toBe("claimWin");
    s().clearSlip("claimWin");
    expect(s().slip).toBeNull();
  });

  it("setViewer clears the sign-in slip", () => {
    const s = useRoomStore.getState;
    s().setSlip({ kind: "signIn" });
    s().setViewer(BIRNA);
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
    expect(s().holdRound).toBeNull();
    // Re-hydrating the same match (a poll) keeps them.
    s().setSlip(OVER);
    s().beginHold(3);
    s().hydrateMatch(matchState("m2"), "you");
    expect(s().slip?.kind).toBe("matchOver");
    expect(s().holdRound).toBe(3);
  });
});
