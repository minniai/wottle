import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRoomStore } from "@/lib/room/roomStore";
import type { MatchState, MoveResolution, PlayerMatchFacts } from "@/lib/types/match";
import { SEATED_TABLE } from "@/lib/match/table";

const A = "player-a";
const B = "player-b";

function board(letter = "A"): string[][] {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => letter));
}

const facts = (playerId: string, over: Partial<PlayerMatchFacts> = {}): PlayerMatchFacts => ({ playerId, movesPlayed: 0, score: 0, inFlight: null, lastResolution: null, ...over });

function matchState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: "m1",
    board: board("H"),
    state: "in_progress",
    players: { playerA: facts(A), playerB: facts(B) },
    clock: { startedAt: "2026-01-01T00:00:00Z", deadlineAt: "2026-01-01T00:05:00Z", serverNow: "2026-01-01T00:00:01Z" },
    moveLimit: 10,
    language: "is",
    resolvedSeq: 0,
    scores: { playerA: 0, playerB: 0 },
    frozenTiles: {},
    table: SEATED_TABLE,
    stakes: null,
    ...overrides,
  };
}

const resolution = (over: Partial<MoveResolution> = {}): MoveResolution => ({
  matchId: "m1", moveId: "mv-1", playerId: A, globalSeq: 1, seq: 1, status: "resolved",
  swap: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, board: board("X"), words: [], delta: 5,
  totals: { playerA: 5, playerB: 0 }, frozenTiles: { "0,0": { owner: "player_a" } }, movesPlayed: { playerA: 1, playerB: 0 }, resolvedAt: "2026-01-01T00:00:02Z",
  ...over,
});

describe("roomStore (spec 044 data-model §3.1, spec 050)", () => {
  beforeEach(() => {
    useRoomStore.getState().leaveToLobby();
    useRoomStore.setState({ viewer: null, board: board(), connection: "realtime" });
  });

  it("walks lobby → queue → match → final → lobby without clearing the board", () => {
    const s = useRoomStore.getState;
    const initial = s().board;
    s().startQueue(1_000);
    expect(s().phase).toBe("queue");
    expect(s().queue).toEqual({ startedAt: 1_000, lettersLanded: 0 });
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

  it("starting a search takes a leftover slip down (new opponent ▸ from the match-over slip)", () => {
    useRoomStore.setState({ slip: { kind: "matchOver" } as never, slipDismissed: true });
    useRoomStore.getState().startQueue(1_000);
    expect(useRoomStore.getState().slip).toBeNull();
    expect(useRoomStore.getState().slipDismissed).toBe(false);
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

  it("applySnapshot never regresses scores to 0/0", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState({ scores: { playerA: 5, playerB: 0 } }), A);
    s().applySnapshot(matchState({ scores: { playerA: 0, playerB: 0 }, resolvedSeq: 0 }));
    expect(s().match!.scores).toEqual({ playerA: 5, playerB: 0 });
  });

  // Spec 050: a poll that lags a resolution keeps what the resolution wrote.
  it("applySnapshot behind the resolution cursor keeps the resolved board and counts, taking only the clock and disconnect", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState(), A);
    s().applyResolution(resolution());
    expect(s().match!.resolvedSeq).toBe(1);
    s().applySnapshot(matchState({ resolvedSeq: 0, disconnectedPlayerId: B, clock: { startedAt: "x", deadlineAt: "y", serverNow: "z" } }));
    expect(s().match!.resolvedSeq).toBe(1);
    expect(s().board).toEqual(board("X"));
    expect(s().match!.players.playerA.movesPlayed).toBe(1);
    expect(s().match!.disconnectedPlayerId).toBe(B);
    expect(s().match!.clock.serverNow).toBe("z");
  });

  // Spec 047 FR-004 (review S5): a rematch replaces the match in place, and the
  // store must not carry the previous match's facts into the new one.
  it("applySnapshot for another matchId drops the previous match entirely", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState({ scores: { playerA: 5, playerB: 0 }, resolvedSeq: 3 }), A);
    s().applySnapshot(matchState({ matchId: "m2", scores: { playerA: 0, playerB: 0 }, resolvedSeq: 0 }));
    expect(s().match!.matchId).toBe("m2");
    expect(s().match!.scores).toEqual({ playerA: 0, playerB: 0 });
    expect(s().match!.resolvedSeq).toBe(0);
  });

  it("applyResolution writes the board, freezes, totals, counts and the mover's last resolution", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState({ players: { playerA: facts(A, { inFlight: { moveId: "mv-1", globalSeq: 1, receivedAt: "" } }), playerB: facts(B) } }), A);
    const r = resolution();
    s().applyResolution(r);
    expect(s().match!.board).toEqual(board("X"));
    expect(s().board).toEqual(board("X"));
    expect(s().match!.frozenTiles).toEqual({ "0,0": { owner: "player_a" } });
    expect(s().match!.scores).toEqual({ playerA: 5, playerB: 0 });
    expect(s().match!.resolvedSeq).toBe(1);
    expect(s().match!.players.playerA).toMatchObject({ movesPlayed: 1, score: 5, inFlight: null, lastResolution: r });
    expect(s().match!.players.playerB.lastResolution).toBeNull();
  });

  it("applyResolution is idempotent and ignores another match or an older sequence", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState({ resolvedSeq: 2 }), A);
    s().applyResolution(resolution({ globalSeq: 2 }));
    expect(s().match!.players.playerA.lastResolution).toBeNull();
    s().applyResolution(resolution({ matchId: "m2", globalSeq: 3 }));
    expect(s().match!.resolvedSeq).toBe(2);
    s().applyResolution(resolution({ globalSeq: 3 }));
    s().applyResolution(resolution({ globalSeq: 3, totals: { playerA: 99, playerB: 0 } }));
    expect(s().match!.scores).toEqual({ playerA: 5, playerB: 0 });
  });

  it("the hold is one move at a time and resets with a new match", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState(), A);
    s().beginHold(4);
    expect(s().holdMove).toBe(4);
    s().hydrateMatch(matchState({ matchId: "m2" }), A);
    expect(s().holdMove).toBeNull();
    s().beginHold(1);
    s().endHold();
    expect(s().holdMove).toBeNull();
  });

  it("tracks the connection mode", () => {
    useRoomStore.getState().setConnection("polling");
    expect(useRoomStore.getState().connection).toBe("polling");
  });

  it("queue: the letters landed count advances", () => {
    const s = useRoomStore.getState;
    s().startQueue(0);
    s().setLettersLanded(58);
    expect(s().queue?.lettersLanded).toBe(58);
  });
});

describe("roomStore performance marks (spec 044 T100)", () => {
  it("marks room:phase-change once per phase transition, not on same-phase updates", () => {
    const mark = vi.spyOn(performance, "mark").mockImplementation(() => ({}) as PerformanceMark);
    useRoomStore.getState().leaveToLobby();
    mark.mockClear();
    useRoomStore.getState().startQueue(1_000);
    useRoomStore.getState().setLettersLanded(5);
    useRoomStore.getState().cancelQueue();
    const phaseMarks = mark.mock.calls.filter(([name]) => name === "room:phase-change");
    expect(phaseMarks).toHaveLength(2);
    expect(phaseMarks[0][1]).toEqual({ detail: { from: "lobby", to: "queue" } });
    mark.mockRestore();
  });
});

describe("roomStore: each player's last resolved move, for the tick (spec 068 FR-027, decision 1A)", () => {
  beforeEach(() => useRoomStore.getState().leaveToLobby());

  it("keeps each player's latest resolved move; a refusal never replaces it", () => {
    const store = useRoomStore.getState();
    store.hydrateMatch(matchState(), A);
    store.applyResolution(resolution({ globalSeq: 1 }));
    store.applyResolution(resolution({ globalSeq: 2, status: "rejected", swap: { from: { x: 9, y: 9 }, to: { x: 8, y: 9 } } }));
    expect(useRoomStore.getState().lastResolved[A]?.globalSeq).toBe(1);
  });

  it("takes a snapshot's last move only when it resolved, so a reload onto a refusal draws no tick", () => {
    const store = useRoomStore.getState();
    store.hydrateMatch(matchState({ players: { playerA: facts(A), playerB: facts(B, { lastResolution: resolution({ playerId: B, status: "rejected" }) }) } }), A);
    expect(useRoomStore.getState().lastResolved[B]).toBeUndefined();
    store.applySnapshot(matchState({ resolvedSeq: 3, players: { playerA: facts(A), playerB: facts(B, { lastResolution: resolution({ playerId: B, globalSeq: 3 }) }) } }));
    expect(useRoomStore.getState().lastResolved[B]?.globalSeq).toBe(3);
  });

  it("forgets them with the match", () => {
    const store = useRoomStore.getState();
    store.hydrateMatch(matchState(), A);
    store.applyResolution(resolution({ globalSeq: 1 }));
    store.leaveToLobby();
    expect(useRoomStore.getState().lastResolved).toEqual({});
  });

  it("a void table stays in the match phase: it has no final state (spec 069)", () => {
    const s = useRoomStore.getState;
    s().hydrateMatch(matchState({ state: "completed", endedReason: "void" }), A);
    expect(s().phase).toBe("match");
  });

  it("keeps the table's stakes after go, when snapshots no longer carry them (spec 069 US8)", () => {
    const s = useRoomStore.getState;
    const stakes = { [A]: { win: 8, draw: 0, loss: -9 } };
    s().hydrateMatch(matchState({ state: "pending", stakes }), A);
    s().applySnapshot(matchState({ stakes: null }));
    expect(s().stakes).toEqual(stakes);
    s().hydrateMatch(matchState({ matchId: "m2", stakes: null }), A);
    expect(s().stakes).toBeNull();
  });
});
