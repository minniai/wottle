import { describe, expect, it } from "vitest";

import {
  markRoundCompleted,
  nextRoundNumber,
  registerSubmission,
  shouldAdvanceRound,
} from "@/lib/match/stateMachine";
import type { RoundTracker } from "@/lib/types/match";

function createRound(roundNumber = 1): RoundTracker {
  return {
    matchId: "match-1",
    roundNumber,
    phase: "collecting",
    submissions: {
      player_a: { playerId: "player-a", status: "pending" },
      player_b: { playerId: "player-b", status: "pending" },
    },
  };
}

describe("stateMachine.registerSubmission", () => {
  it("marks submission as accepted and transitions to resolving when both submitted", () => {
    const base = createRound();

    const withA = registerSubmission({
      round: base,
      slot: "player_a",
      playerId: "player-a",
      move: { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
      submittedAt: Date.now(),
    });

    expect(withA.phase).toBe("collecting");
    expect(withA.submissions.player_a.status).toBe("accepted");

    const resolved = registerSubmission({
      round: withA,
      slot: "player_b",
      playerId: "player-b",
      move: { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
      submittedAt: Date.now(),
    });

    expect(resolved.phase).toBe("resolving");
    expect(resolved.submissions.player_b.status).toBe("accepted");
  });

  it("marks duplicate swap as ignored when signatures match", () => {
    const round = createRound();

    const first = registerSubmission({
      round,
      slot: "player_a",
      playerId: "player-a",
      move: { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
      submittedAt: Date.now(),
    });

    const duplicate = registerSubmission({
      round: first,
      slot: "player_b",
      playerId: "player-b",
      move: { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
      submittedAt: Date.now(),
    });

    expect(duplicate.submissions.player_b.status).toBe("ignored_same_move");
  });
});

describe("round advancement helpers", () => {
  it("marks round completed", () => {
    const complete = markRoundCompleted(createRound());
    expect(complete.phase).toBe("completed");
  });

  it("computes next round respecting round limit", () => {
    expect(nextRoundNumber(createRound(1), 10)).toBe(2);
    expect(nextRoundNumber(createRound(10), 10)).toBeNull();
  });

  it("signals when round should advance", () => {
    const round = markRoundCompleted(createRound());
    expect(shouldAdvanceRound(round)).toBe(true);
  });
});

