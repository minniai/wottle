"use client";

import { create } from "zustand";

import { outranks, type SlipKind, type SlipState } from "./slip";
import type { MatchState, MoveResolution, PlayerIdentity, PlayerSlot } from "@/lib/types/match";

/**
 * Client model of the one room (spec 044 data-model §3.1). Lobby, queue, found,
 * match and final are phases of the same store; the field never unmounts, so
 * `board` is only ever *replaced* by real data, never cleared by a phase change.
 * Server-authoritative state lives in `match`; everything else is presentation.
 */
export type RoomPhase = "lobby" | "queue" | "found" | "match" | "final";
export type ConnectionMode = "realtime" | "polling";

export interface QueueState {
  startedAt: number;
  lettersLanded: number;
}

export interface RoomState {
  phase: RoomPhase;
  viewer: PlayerIdentity | null;
  viewerSlot: PlayerSlot | null;
  opponent: PlayerIdentity | null;
  match: MatchState | null;
  board: string[][];
  queue: QueueState | null;
  /** Bumped to start a fresh search for an opponent; the queue controller remounts on it. */
  searchId: number;
  found: { countdown: 3 | 2 | 1 } | null;
  connection: ConnectionMode;
  /** The one overlay (spec 048 §5.9); precedence enforced by `setSlip`. */
  slip: SlipState | null;
  /** Final phase: `review the field ▸` hides the match-over slip; `result ▸` restores it. */
  slipDismissed: boolean;
  /** The viewer's move (its per-player sequence) held after its reveal before the next opens (spec 050 FR-013). */
  holdMove: number | null;

  setViewer: (viewer: PlayerIdentity | null) => void;
  setOpponent: (opponent: PlayerIdentity | null) => void;
  setBoard: (board: string[][]) => void;
  setConnection: (mode: ConnectionMode) => void;
  /** Enter a phase. Never touches `board`. */
  setPhase: (phase: RoomPhase) => void;
  startQueue: (now?: number) => void;
  /** `new opponent ▸`: a fresh search even when the route is already /matchmaking. */
  requestNewSearch: () => void;
  cancelQueue: () => void;
  /** Placeholder letters landed so far (queue state). */
  setLettersLanded: (count: number) => void;
  /** Opponent found: the top bar writes them in and counts the start down. */
  setFound: (opponent: PlayerIdentity | null, countdown: 3 | 2 | 1) => void;
  /** Load a server snapshot; derives viewerSlot and picks match|final from `state`. */
  hydrateMatch: (state: MatchState, viewerId: string | null) => void;
  /** Merge a broadcast/polled snapshot; never regresses the resolution cursor or the scores. */
  applySnapshot: (snapshot: MatchState) => void;
  /** One finished move (`move-resolved`); idempotent under the safety poll. */
  applyResolution: (resolution: MoveResolution) => void;
  leaveToLobby: () => void;
  /** Show a slip unless a higher-ranked one is already up. */
  setSlip: (next: SlipState) => void;
  /** Take down a slip of that kind only. */
  clearSlip: (kind: SlipKind) => void;
  dismissSlip: () => void;
  restoreSlip: () => void;
  beginHold: (move: number) => void;
  endHold: () => void;
}

const EMPTY_BOARD: string[][] = [];

function phaseForMatch(state: MatchState): RoomPhase {
  return state.state === "completed" || state.state === "abandoned" ? "final" : "match";
}

function deriveViewerSlot(state: MatchState, viewerId: string | null): PlayerSlot | null {
  if (!viewerId) return null;
  if (state.players.playerA.playerId === viewerId) return "player_a";
  if (state.players.playerB.playerId === viewerId) return "player_b";
  return null;
}

/**
 * A fresh poll may lag a broadcast; never regress. A snapshot behind the
 * resolution cursor keeps what the resolutions wrote and takes only the facts
 * a lagging read can still carry truthfully. A snapshot for another match (a
 * rematch replaced the match in place) carries nothing over — spec 047 FR-004.
 */
function mergeSnapshot(previous: MatchState | null, snapshot: MatchState): MatchState {
  if (!previous || previous.matchId !== snapshot.matchId) return snapshot;
  if (snapshot.resolvedSeq < previous.resolvedSeq) {
    return {
      ...previous,
      state: snapshot.state === "completed" || snapshot.state === "abandoned" ? snapshot.state : previous.state,
      clock: snapshot.clock,
      disconnectedPlayerId: snapshot.disconnectedPlayerId,
      disconnectedAt: snapshot.disconnectedAt,
      reconnectWindowMs: snapshot.reconnectWindowMs,
    };
  }
  const scores =
    snapshot.scores.playerA === 0 && snapshot.scores.playerB === 0 &&
    (previous.scores.playerA > 0 || previous.scores.playerB > 0)
      ? previous.scores
      : snapshot.scores;
  return { ...snapshot, scores };
}

function withResolution(current: MatchState, r: MoveResolution): MatchState {
  const slot = r.playerId === current.players.playerA.playerId ? "playerA" : "playerB";
  const other = slot === "playerA" ? "playerB" : "playerA";
  const players = {
    [slot]: {
      ...current.players[slot],
      movesPlayed: r.movesPlayed[slot],
      score: r.totals[slot],
      inFlight: null,
      lastResolution: r,
    },
    [other]: { ...current.players[other], movesPlayed: r.movesPlayed[other], score: r.totals[other] },
  } as MatchState["players"];
  return { ...current, board: r.board, frozenTiles: r.frozenTiles, scores: r.totals, resolvedSeq: r.globalSeq, players };
}

export const useRoomStore = create<RoomState>((set, get) => ({
  phase: "lobby",
  viewer: null,
  viewerSlot: null,
  opponent: null,
  match: null,
  board: EMPTY_BOARD,
  queue: null,
  searchId: 0,
  found: null,
  connection: "realtime",
  slip: null,
  slipDismissed: false,
  holdMove: null,

  // A signed-in viewer never sees the sign-in slip (spec 048 data-model §2).
  setViewer: (viewer) =>
    set((s) => ({ viewer, slip: viewer && s.slip?.kind === "signIn" ? null : s.slip })),
  setOpponent: (opponent) => set({ opponent }),
  setBoard: (board) => set({ board }),
  setConnection: (connection) => set({ connection }),
  setPhase: (phase) => set({ phase }),

  startQueue: (now = Date.now()) =>
    set({ phase: "queue", queue: { startedAt: now, lettersLanded: 0 }, opponent: null, match: null }),

  requestNewSearch: () => set((s) => ({ searchId: s.searchId + 1 })),

  cancelQueue: () => set({ phase: "lobby", queue: null, found: null }),

  setLettersLanded: (count) => set((s) => (s.queue ? { queue: { ...s.queue, lettersLanded: count } } : {})),

  setFound: (opponent, countdown) => set({ phase: "found", opponent, found: { countdown }, queue: null }),

  hydrateMatch: (state, viewerId) =>
    set((s) => ({
      match: state,
      board: state.board,
      viewerSlot: deriveViewerSlot(state, viewerId),
      phase: phaseForMatch(state),
      queue: null,
      found: null,
      // Another match in the same room (a rematch) starts with no slip and no hold.
      ...(s.match?.matchId === state.matchId ? {} : { slip: null, slipDismissed: false, holdMove: null }),
    })),

  applySnapshot: (snapshot) => {
    const merged = mergeSnapshot(get().match, snapshot);
    set({ match: merged, board: merged.board, phase: phaseForMatch(merged) });
  },

  applyResolution: (resolution) => {
    const current = get().match;
    if (!current || resolution.matchId !== current.matchId) return;
    if (resolution.globalSeq <= current.resolvedSeq) return;
    const next = withResolution(current, resolution);
    set({ match: next, board: next.board });
  },

  leaveToLobby: () =>
    set({ phase: "lobby", match: null, opponent: null, viewerSlot: null, queue: null, found: null, slip: null, slipDismissed: false, holdMove: null }),

  setSlip: (next) => set((s) => (outranks(s.slip, next) ? {} : { slip: next, slipDismissed: s.slip?.kind === next.kind ? s.slipDismissed : false })),
  clearSlip: (kind) => set((s) => (s.slip?.kind === kind ? { slip: null, slipDismissed: false } : {})),
  dismissSlip: () => set({ slipDismissed: true }),
  restoreSlip: () => set({ slipDismissed: false }),
  beginHold: (move) => set({ holdMove: move }),
  endHold: () => set({ holdMove: null }),
}));

/** One `room:phase-change` mark per transition (spec 044 T100); the room never remounts, so this is the only phase signal. */
useRoomStore.subscribe((state, previous) => {
  if (state.phase === previous.phase) return;
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  performance.mark("room:phase-change", { detail: { from: previous.phase, to: state.phase } });
});
