"use client";

import { useEffect, useState } from "react";

import { Field } from "@/components/room/Field";
import type { CellState } from "@/components/room/FieldCell";
import { LobbyRoomView } from "@/components/room/LobbyRoomView";
import { MatchRoomView } from "@/components/room/MatchRoomView";
import { QueueRoomView } from "@/components/room/QueueRoomView";
import { RoomShell } from "@/components/room/RoomShell";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { OPPONENT, TAP_SECOND_LETTER, startsIn, searchingSubline, settingField } from "@/lib/constants/copy";
import type { Seat } from "@/lib/constants/seatColors";
import { bandsFromWords } from "@/lib/room/bandGeometry";
import { applyLetterSwaps } from "@/lib/room/displayBoard";
import { same } from "@/lib/room/fieldInteraction";
import { useRoomStore, type RoomPhase as StorePhase } from "@/lib/room/roomStore";
import type { AccumulatedWord, LiveState } from "@/lib/room/ledgerRows";
import type { SlipState } from "@/lib/room/slip";
import { turnFrameFor, type MoveState } from "@/lib/room/moveState";
import type { Coordinate } from "@/lib/types/board";
import type { MatchResult, MatchState } from "@/lib/types/match";
import {
  BIRNA,
  CLOCK_MS,
  DISCONNECT_STATE,
  DONE,
  DONE_STATE,
  END_EARLY_SLIP,
  FINAL_STATE,
  FINAL_VERDICT,
  FIXTURE_BOARD,
  FIXTURE_FROZEN,
  FIXTURE_WORDS,
  HOLD_MOVE,
  ILLEGAL_CELL,
  ILLEGAL_LIVE,
  KARI,
  LOBBY_PLAYERS,
  LAST_SECONDS_MS,
  LOW_CLOCK_MS,
  MATCH_STATE,
  OPP_FINAL_LINE,
  OPP_ID,
  OPP_REVEAL_WORD,
  OVER_SLIP,
  PICKED_CELL,
  PICKED_LIVE,
  PREVIEW_CELLS,
  PREVIEW_LIVE,
  PROFILE_FIXTURE,
  QUEUE_ELAPSED,
  QUEUE_LETTERS_LANDED,
  RECENT_GAMES,
  RECONNECT_MS_LEFT,
  REJECTED_M5,
  RESIGN_SLIP,
  SCORED_M4,
  SCORED_WORD,
  SCORING_M4,
  TIME_UP,
  YOU_FINAL_LINE,
  YOU_ID,
  YOUR_MOVE,
  type RoomPhase,
} from "./fixtures";

const NO_OP = () => undefined;

const BANDS = bandsFromWords({
  words: FIXTURE_WORDS,
  board: FIXTURE_BOARD,
  frozenTiles: FIXTURE_FROZEN,
  viewerSlot: "player_a",
  playerAId: YOU_ID,
});

/** A word landing on the field: its band at live strength, drawn from its coordinates (spec 050). */
function liveBands(word: AccumulatedWord) {
  const key = `${word.playerId}:${word.moveSeq}`;
  return bandsFromWords({ words: [...FIXTURE_WORDS, word], board: FIXTURE_BOARD, frozenTiles: FIXTURE_FROZEN, viewerSlot: "player_a", playerAId: YOU_ID, liveMoveKey: key, trustMoveKey: key });
}
const SCORING_BANDS = liveBands(SCORED_WORD);
const OPP_REVEAL_BANDS = liveBands(OPP_REVEAL_WORD);

/** The marks one match phase puts on the field (spec 047 amendment P2). */
interface FieldMarks {
  picked?: Coordinate;
  previewed?: [Coordinate, Coordinate];
  shakeAt?: Coordinate;
}

const isPicked = (marks: FieldMarks, at: Coordinate) => marks.picked !== undefined && same(marks.picked, at);
const inPair = (pair: [Coordinate, Coordinate] | undefined, at: Coordinate) => pair?.some((c) => same(c, at)) ?? false;

function markedState(marks: FieldMarks, at: Coordinate, base: CellState): CellState {
  if (isPicked(marks, at)) return "picked";
  if (inPair(marks.previewed, at)) return "previewed";
  return base;
}

function markedSeat(marks: FieldMarks, at: Coordinate): Seat | null {
  return isPicked(marks, at) || inPair(marks.previewed, at) ? "you" : null;
}

/** The match field with the played moves drawn as bands and one phase's marks on it. */
function MatchField({ drawnCount, marks, turnFrame, disabled, bands = BANDS, frozenTiles = FIXTURE_FROZEN }: { drawnCount: number | null; marks: FieldMarks; turnFrame: Seat | null; disabled: boolean; bands?: typeof BANDS; frozenTiles?: typeof FIXTURE_FROZEN }) {
  const board = marks.previewed ? applyLetterSwaps(FIXTURE_BOARD, [marks.previewed]) : FIXTURE_BOARD;
  return (
    <Field
      board={board}
      turnFrame={turnFrame}
      disabled={disabled}
      frozenTiles={frozenTiles}
      viewerSlot="player_a"
      ownerNames={{ player_a: BIRNA.displayName, player_b: KARI.displayName }}
      bands={bands}
      drawnCount={drawnCount}
      cellStateFor={(at, base) => markedState(marks, at, base)}
      seatFor={(at) => markedSeat(marks, at)}
      shakeAt={marks.shakeAt ?? null}
      exchange={marks.previewed ?? null}
      onActivate={NO_OP}
    />
  );
}

interface SeatOptions {
  completed: boolean;
  reconnectMsLeft: number | null;
  /** Both players' moves and totals in this phase. */
  you?: { moves: number; score: number; scoring?: boolean };
  opp?: { moves: number; score: number; scoring?: boolean };
}

function matchSeats({ completed, reconnectMsLeft, you = { moves: 3, score: 46 }, opp = { moves: 6, score: 15 } }: SeatOptions) {
  return {
    you: {
      name: BIRNA.displayName,
      rating: BIRNA.eloRating ?? null,
      movesPlayed: you.moves,
      scoring: you.scoring,
      score: you.score,
      finalLine: completed ? YOU_FINAL_LINE : undefined,
    },
    opp: {
      name: KARI.displayName,
      rating: KARI.eloRating ?? null,
      movesPlayed: opp.moves,
      scoring: opp.scoring,
      score: opp.score,
      reconnectMsLeft,
      finalLine: completed ? OPP_FINAL_LINE : undefined,
    },
  };
}

interface MatchPhaseSpec {
  live: LiveState;
  marks: FieldMarks;
  /** The viewer's beat (spec 050); omitted for the final state. */
  moveState?: MoveState;
  holdMove?: number;
  clockMs?: number;
  /** Words landing in this phase, drawn at live strength. */
  liveWord?: AccumulatedWord;
  /** The match snapshot the phase shows; the base match state when omitted. */
  state?: MatchState;
  seats?: Pick<SeatOptions, "you" | "opp">;
}

const IDLE: MatchPhaseSpec = { live: { kind: "idle" }, marks: {}, moveState: YOUR_MOVE };
const PICKING: MatchPhaseSpec = { live: PICKED_LIVE, marks: { picked: PICKED_CELL }, moveState: YOUR_MOVE };
const DONE_SEATS = { you: { moves: 10, score: 134 }, opp: { moves: 8, score: 88 } };

type MatchPhase = Exclude<RoomPhase, "landing-slip" | "lobby" | "queue" | "found" | "profile" | "rules">;

/** Every match-state phase as literals (spec 047 amendment P2, spec 050). */
const MATCH_PHASES: Record<MatchPhase, MatchPhaseSpec> = {
  idle: IDLE,
  picking: PICKING,
  "phone-sheet": PICKING,
  previewed: { live: PREVIEW_LIVE, marks: { previewed: PREVIEW_CELLS }, moveState: YOUR_MOVE },
  illegal: { live: ILLEGAL_LIVE, marks: { shakeAt: ILLEGAL_CELL }, moveState: YOUR_MOVE },
  // Your move 4 resolving: the field is locked and TÆK's band is mid-draw.
  reveal: { live: { kind: "played" }, marks: {}, moveState: SCORING_M4, liveWord: SCORED_WORD, seats: { you: { moves: 3, score: 46, scoring: true } } },
  scoring: { live: { kind: "played" }, marks: {}, moveState: SCORING_M4, seats: { you: { moves: 3, score: 46, scoring: true } } },
  scored: { live: { kind: "idle" }, marks: {}, moveState: SCORED_M4, holdMove: HOLD_MOVE, liveWord: SCORED_WORD, seats: { you: { moves: 4, score: 59 } } },
  // Kári's move 7 landing while you pick: his band draws, your pick stands.
  "opp-reveal": { live: PICKED_LIVE, marks: { picked: PICKED_CELL }, moveState: YOUR_MOVE, liveWord: OPP_REVEAL_WORD, seats: { opp: { moves: 6, score: 15, scoring: true } } },
  rejected: { live: { kind: "idle" }, marks: {}, moveState: REJECTED_M5, seats: { you: { moves: 4, score: 59 }, opp: { moves: 7, score: 28 } } },
  "low-clock": { ...PICKING, clockMs: LOW_CLOCK_MS },
  "last-seconds": { ...PICKING, clockMs: LAST_SECONDS_MS },
  "done-waiting": { live: { kind: "idle" }, marks: {}, moveState: DONE, clockMs: LOW_CLOCK_MS, state: DONE_STATE, seats: DONE_SEATS },
  "time-up": { live: { kind: "idle" }, marks: {}, moveState: TIME_UP, clockMs: 0, state: DONE_STATE, seats: { ...DONE_SEATS, opp: { ...DONE_SEATS.opp, scoring: true } } },
  final: { live: { kind: "idle" }, marks: {}, state: FINAL_STATE, seats: DONE_SEATS },
  disconnect: { live: { kind: "idle" }, marks: {}, moveState: YOUR_MOVE, state: DISCONNECT_STATE },
  resign: IDLE,
  "end-early": { live: { kind: "idle" }, marks: {}, moveState: DONE, clockMs: 72_000, state: { ...DISCONNECT_STATE, ...DONE_STATE, disconnectedPlayerId: OPP_ID }, seats: DONE_SEATS },
  "over-slip": { live: { kind: "idle" }, marks: {}, state: FINAL_STATE, seats: DONE_SEATS },
};

/** The slip each phase seeds (spec 048 contracts/fixture-phases.md). */
const SLIPS: Partial<Record<RoomPhase, SlipState>> = {
  "landing-slip": { kind: "signIn" },
  resign: RESIGN_SLIP,
  "end-early": END_EARLY_SLIP,
  "over-slip": OVER_SLIP,
};

/** The store phase each fixture phase seeds; everything not listed is a match state. */
const STORE_PHASE: Partial<Record<RoomPhase, StorePhase>> = { "landing-slip": "lobby", profile: "lobby", queue: "queue", found: "found", final: "final", "over-slip": "final" };

/** The room for one phase, from `fixtures.ts` alone (spec 045 US1). */
export function RoomFixture({ phase }: { phase: Exclude<RoomPhase, "rules"> }) {
  const [revealed, setRevealed] = useState<number | null>(phase === "reveal" ? 0 : null);

  useEffect(() => {
    // Seed the store so components reading it (Room's data-phase, seat colours)
    // agree with the props. No transport, no timers.
    const store = useRoomStore.getState();
    store.setViewer(phase === "landing-slip" ? null : BIRNA);
    store.setBoard(FIXTURE_BOARD);
    store.setPhase(STORE_PHASE[phase] ?? "match");
    const slip = SLIPS[phase];
    if (slip) store.setSlip(slip);
    else if (store.slip) store.clearSlip(store.slip.kind);
  }, [phase]);

  // The reveal phase holds mid-draw so the band, chevron and count-up are all captured.
  useEffect(() => {
    if (phase !== "reveal") return;
    // The three settled bands are drawn; the fourth (TÆK) is mid-draw.
    const id = setTimeout(() => setRevealed(FIXTURE_WORDS.length), 0);
    return () => clearTimeout(id);
  }, [phase]);

  if (phase === "profile") {
    const profile = {
      identity: { ...BIRNA, createdAt: "2026-03-02T09:00:00.000Z" },
      stats: { eloRating: 1204, gamesPlayed: 34, wins: 19, losses: 15, draws: 0, winRate: 19 / 34 },
      ratingTrend: [1197, 1216, 1186, 1199, 1204],
      bestWord: { word: "BORÐA", points: 38, opponentName: KARI.displayName },
      form: ["W", "L", "W", "W", "L", "W", "L", "W", "W", "L"] as MatchResult[],
      peakRating: 1216,
      ratingHistory: PROFILE_FIXTURE.ratingHistory.map((rating, i) => ({
        rating,
        recordedAt: `2026-0${1 + Math.floor(i / 6)}-${String(1 + (i % 6) * 5).padStart(2, "0")}T12:00:00.000Z`,
      })),
    };
    return (
      <RoomShell viewer={BIRNA}>
        <ProfilePage profile={profile} words={[...PROFILE_FIXTURE.bestWords]} matches={RECENT_GAMES} isSelf />
      </RoomShell>
    );
  }

  if (phase === "landing-slip" || phase === "lobby") {
    const viewer = phase === "landing-slip" ? null : BIRNA;
    return (
      <RoomShell viewer={viewer}>
        <LobbyRoomView
          viewer={viewer}
          players={LOBBY_PLAYERS}
          recentGames={RECENT_GAMES}
          loadingPlayers={false}
          hint={TAP_SECOND_LETTER}
          notices={[]}
          onAction={NO_OP}
          onSignedIn={NO_OP}
        >
          <Field board={FIXTURE_BOARD} viewerSlot="player_a" onActivate={NO_OP} landedCount={viewer ? null : 0} />
        </LobbyRoomView>
      </RoomShell>
    );
  }

  if (phase === "queue" || phase === "found") {
    const found = phase === "found";
    return (
      <RoomShell viewer={BIRNA}>
        <QueueRoomView
          viewer={BIRNA}
          opponent={found ? KARI : null}
          found={found ? { countdown: 3 } : null}
          elapsed={QUEUE_ELAPSED}
          live={found ? startsIn(3) : settingField(QUEUE_LETTERS_LANDED)}
          hint={searchingSubline(QUEUE_ELAPSED)}
          onAction={NO_OP}
        >
          <Field
            board={FIXTURE_BOARD}
            viewerSlot="player_a"
            disabled
            landedCount={found ? null : QUEUE_LETTERS_LANDED}
          />
        </QueueRoomView>
      </RoomShell>
    );
  }

  const completed = phase === "final" || phase === "over-slip";
  const disconnected = phase === "disconnect" || phase === "end-early";
  const spec = MATCH_PHASES[phase];
  const state = spec.state ?? MATCH_STATE;
  const seats = matchSeats({ completed, reconnectMsLeft: disconnected ? (phase === "end-early" ? 0 : RECONNECT_MS_LEFT) : null, ...spec.seats });
  const words = spec.liveWord ? [...FIXTURE_WORDS, spec.liveWord] : FIXTURE_WORDS;
  const bands = spec.liveWord === SCORED_WORD ? SCORING_BANDS : spec.liveWord === OPP_REVEAL_WORD ? OPP_REVEAL_BANDS : BANDS;
  const drawnCount = phase === "reveal" ? revealed : null;
  const locked = spec.holdMove !== undefined || spec.moveState?.kind === "scoring" || spec.moveState?.kind === "done" || spec.moveState?.kind === "timeUp";

  return (
    <RoomShell viewer={BIRNA}>
      <MatchRoomView
        matchId={state.matchId}
        viewerSlot="player_a"
        you={seats.you}
        opp={seats.opp}
        clockMs={spec.clockMs ?? CLOCK_MS}
        moveLimit={10}
        completed={completed}
        words={words}
        playerAId={YOU_ID}
        frozenTiles={FIXTURE_FROZEN}
        live={spec.live}
        moveState={spec.moveState}
        holdMove={spec.holdMove ?? null}
        verdict={completed ? FINAL_VERDICT : undefined}
        caption={completed ? "final · 4:52" : undefined}
        notices={[]}
        hint={disconnected ? `${KARI.displayName} · ${OPPONENT}` : undefined}
        onAction={NO_OP}
      >
        <MatchField drawnCount={drawnCount} marks={spec.marks} turnFrame={spec.moveState ? turnFrameFor(spec.moveState) : null} disabled={completed || locked} bands={bands} />
      </MatchRoomView>
    </RoomShell>
  );
}

export const FIXTURE_OPPONENT_ID = OPP_ID;
