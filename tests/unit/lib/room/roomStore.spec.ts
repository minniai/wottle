import { beforeEach, describe, expect, it } from "vitest";

import { useRoomStore } from "@/lib/room/roomStore";
import type { MatchState, RoundSummary } from "@/lib/types/match";

const A = "player-a";
const B = "player-b";

function board(letter = "A"): string[][] {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => letter));
}

function matchState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: "m1",
    board: board("H"),
    currentRound: 1,
    state: "collecting",
    timers: {
      playerA: { playerId: A, remainingMs: 300_000, status: "running" },
      playerB: { playerId: B, remainingMs: 300_000, status: "running" },
    },
    scores: { playerA: 0, playerB: 0 },
    ...overrides,
  };
}

describe("roomStore (spec 044 data-model §3.1)", () => {
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    useRoomStore.setState({ viewer: null, board: board(), connection: "realtime" });
  });

  it("walks lobby → queue → found → match → final → lobby without clearing the board", () => {
    const s = useRoomStore.getState;
    const initial = s().board;
    s().startQueue(1_000);
    expect(s().phase).toBe("queue");
    expect(s().queue).toEqual({ startedAt: 1_000, lettersLanded: 0 });
    expect(s().board).toBe(initial);

    s().setPhase("found");
    expect(s().board).toBe(initial);

    s().hydrateMatch(matchState(), A);
    expect(s().phase).toBe("match");
    expect(s().viewerSlot).toBe("player_a");
    expect(s().board).toBe(s().match!.board);

    s().applySnapshot(matchState({ state: "completed", scores: { playerA: 12, playerB: 7 } }));
    expect(s().phase).toBe("final");
    const matchBoard = s().board;

    s().leaveToLobby();
    expect(s().phase).toBe("lobby");
    expect(s().match).toBeNull();
    expect(s().board).toBe(matchBoard); // the field keeps showing the last board
  });

  it("queue → lobby on cancel keeps the board", () => {
    const s = useRoomStore.getState;
    const initial = s().board;
    s().startQueue();
    s().cancelQueue();
    expect(s().phase).toBe("lobby");
    expect(s().queue).toBeNull();
    expect(s().board).toBe(initial);
  });

  it("derives viewerSlot for player B and null for a non-participant", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState(), B);
    expect(s().viewerSlot).toBe("player_b");
    s().hydrateMatch(matchState(), "stranger");
    expect(s().viewerSlot).toBeNull();
  });

  it("applySnapshot never regresses scores to 0/0 and keeps the last summary", () => {
    const s = useRoomStore.getState;
    const summary: RoundSummary = {
      matchId: "m1", roundNumber: 1, words: [], deltas: { playerA: 5, playerB: 0 },
      totals: { playerA: 5, playerB: 0 }, highlights: [], resolvedAt: "2026-01-01T00:00:00Z", moves: [],
    };
    s().hydrateMatch(matchState({ scores: { playerA: 5, playerB: 0 }, lastSummary: summary }), A);
    s().applySnapshot(matchState({ scores: { playerA: 0, playerB: 0 }, lastSummary: null, currentRound: 2 }));
    expect(s().match!.scores).toEqual({ playerA: 5, playerB: 0 });
    expect(s().match!.lastSummary).toEqual(summary);
    expect(s().match!.currentRound).toBe(2);
  });

  it("applySummary updates totals and lastSummary", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState(), A);
    const summary: RoundSummary = {
      matchId: "m1", roundNumber: 1, words: [], deltas: { playerA: 0, playerB: 9 },
      totals: { playerA: 0, playerB: 9 }, highlights: [], resolvedAt: "2026-01-01T00:00:00Z", moves: [],
    };
    s().applySummary(summary);
    expect(s().match!.scores).toEqual({ playerA: 0, playerB: 9 });
    expect(s().match!.lastSummary).toBe(summary);
  });

  it("tracks the connection mode", () => {
    useRoomStore.getState().setConnection("polling");
    expect(useRoomStore.getState().connection).toBe("polling");
  });

  it("queue: letters landed count advances; found writes the opponent and counts down", () => {
    const s = useRoomStore.getState;
    s().startQueue(0);
    s().setLettersLanded(58);
    expect(s().queue?.lettersLanded).toBe(58);
    const kari = { id: "k", username: "kari", displayName: "Kári", status: "in_match" as const, lastSeenAt: "" };
    s().setFound(kari, 3);
    expect(s().phase).toBe("found");
    expect(s().opponent?.displayName).toBe("Kári");
    expect(s().found).toEqual({ countdown: 3 });
    expect(s().queue).toBeNull();
  });
});

