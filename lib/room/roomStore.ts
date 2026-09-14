"use client";

import { create } from "zustand";

import type { MatchState, PlayerIdentity, PlayerSlot, RoundSummary } from "@/lib/types/match";

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
  found: { countdown: 3 | 2 | 1 } | null;
  connection: ConnectionMode;

  setViewer: (viewer: PlayerIdentity | null) => void;
  setOpponent: (opponent: PlayerIdentity | null) => void;
  setBoard: (board: string[][]) => void;
  setConnection: (mode: ConnectionMode) => void;
  /** Enter a phase. Never touches `board`. */
  setPhase: (phase: RoomPhase) => void;
  startQueue: (now?: number) => void;
  cancelQueue: () => void;
  /** Placeholder letters landed so far (queue state). */
  setLettersLanded: (count: number) => void;
  /** Opponent found: the top bar writes them in and counts round 1 down. */
  setFound: (opponent: PlayerIdentity | null, countdown: 3 | 2 | 1) => void;
  /** Load a server snapshot; derives viewerSlot and picks match|final from `state`. */
  hydrateMatch: (state: MatchState, viewerId: string | null) => void;
  /** Merge a broadcast/polled snapshot, keeping scores and the last summary sticky. */
  applySnapshot: (snapshot: MatchState) => void;
  applySummary: (summary: RoundSummary) => void;
  leaveToLobby: () => void;
}

const EMPTY_BOARD: string[][] = [];

function phaseForMatch(state: MatchState): RoomPhase {
  return state.state === "completed" || state.state === "abandoned" ? "final" : "match";
}

function deriveViewerSlot(state: MatchState, viewerId: string | null): PlayerSlot | null {
  if (!viewerId) return null;
  if (state.timers.playerA.playerId === viewerId) return "player_a";
  if (state.timers.playerB.playerId === viewerId) return "player_b";
  return null;
}

/** Ported from MatchClient.applySnapshot: a fresh poll may lag a broadcast; never regress. */
function mergeSnapshot(previous: MatchState | null, snapshot: MatchState): MatchState {
  if (!previous) return snapshot;
  const scores =
    snapshot.scores.playerA === 0 && snapshot.scores.playerB === 0 &&
    (previous.scores.playerA > 0 || previous.scores.playerB > 0)
      ? previous.scores
      : snapshot.scores;
  const lastSummary = snapshot.lastSummary ?? previous.lastSummary ?? null;
  return { ...snapshot, scores, lastSummary };
}

export const useRoomStore = create<RoomState>((set, get) => ({
  phase: "lobby",
  viewer: null,
  viewerSlot: null,
  opponent: null,
  match: null,
  board: EMPTY_BOARD,
  queue: null,
  found: null,
  connection: "realtime",

  setViewer: (viewer) => set({ viewer }),
  setOpponent: (opponent) => set({ opponent }),
  setBoard: (board) => set({ board }),
  setConnection: (connection) => set({ connection }),
  setPhase: (phase) => set({ phase }),

  startQueue: (now = Date.now()) =>
    set({ phase: "queue", queue: { startedAt: now, lettersLanded: 0 }, opponent: null, match: null }),

  cancelQueue: () => set({ phase: "lobby", queue: null, found: null }),

  setLettersLanded: (count) => set((s) => (s.queue ? { queue: { ...s.queue, lettersLanded: count } } : {})),

  setFound: (opponent, countdown) => set({ phase: "found", opponent, found: { countdown }, queue: null }),

  hydrateMatch: (state, viewerId) =>
    set({
      match: state,
      board: state.board,
      viewerSlot: deriveViewerSlot(state, viewerId),
      phase: phaseForMatch(state),
      queue: null,
      found: null,
    }),

  applySnapshot: (snapshot) => {
    const merged = mergeSnapshot(get().match, snapshot);
    set({ match: merged, board: merged.board, phase: phaseForMatch(merged) });
  },

  applySummary: (summary) => {
    const current = get().match;
    if (!current) return;
    set({ match: { ...current, scores: summary.totals, lastSummary: summary } });
  },

  leaveToLobby: () =>
    set({ phase: "lobby", match: null, opponent: null, viewerSlot: null, queue: null, found: null }),
}));

/** One `room:phase-change` mark per transition (spec 044 T100); the room never remounts, so this is the only phase signal. */
useRoomStore.subscribe((state, previous) => {
  if (state.phase === previous.phase) return;
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  performance.mark("room:phase-change", { detail: { from: previous.phase, to: state.phase } });
});
