"use client";

import { useEffect, useState } from "react";

import { Field } from "@/components/room/Field";
import type { CellState } from "@/components/room/FieldCell";
import { MatchRoomView } from "@/components/room/MatchRoomView";
import { RoomShell } from "@/components/room/RoomShell";
import { PageFrame } from "@/components/page/PageFrame";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import type { Copy } from "@/lib/i18n/copy/types";
import type { Seat } from "@/lib/constants/seatColors";
import { bandsFromWords } from "@/lib/room/bandGeometry";
import { same } from "@/lib/room/fieldInteraction";
import { useRoomStore, type RoomPhase as StorePhase } from "@/lib/room/roomStore";
import type { AccumulatedWord, LiveState } from "@/lib/room/ledgerRows";
import type { SlipState } from "@/lib/room/slip";
import { turnFrameFor, type Line2Extras, type MoveState } from "@/lib/room/moveState";
import { tableSlipFor } from "@/lib/room/tableSlip";
import { tableFacts } from "@/components/room/hooks/useTable";
import { ReviewFixture, type ReviewPhase } from "./ReviewFixture";
import { BLANK_BOARD } from "@/lib/constants/board";
import type { Coordinate } from "@/lib/types/board";
import type { MatchResult, MatchState } from "@/lib/types/match";
import {
  BIRNA,
  CLOCK_MS,
  DISCONNECT_STATE,
  DONE,
  DONE_STATE,
  END_EARLY_SLIP,
  LEAVE_SLIP,
  FINAL_STATE,
  FIXTURE_BOARD,
  finalLines,
  finalVerdict,
  isRematchPhase,
  isResultPhase,
  REMATCH_PHASES,
  rematchSlip,
  overSlip,
  RESULT_PHASES,
  resultSlip,
  resultState,
  resultVerdict,
  FIXTURE_FROZEN,
  FIXTURE_WORDS,
  HOLD_MOVE,
  TABLE_NOW_MS,
  tableState,
  voidState,
  VOID_SEARCHING_ELAPSED,
  ILLEGAL_CELL,
  ILLEGAL_LIVE,
  KARI,
  LOBBY_PLAYERS,
  LAST_SECONDS_MS,
  LOW_CLOCK_MS,
  MATCH_STATE,
  OPP_ID,
  OPP_REVEAL_WORD,
  PICKED_CELL,
  PICKED_LIVE,
  PROFILE_FIXTURE,
  QUEUE_ELAPSED,
  QUEUE_LETTERS_LANDED,
  RECENT_GAMES,
  RECONNECT_MS_LEFT,
  GONE_FOR_MS,
  FINAL_CLOCK_MS,
  FINAL_ELAPSED_MS,
  MS_TO_START,
  REJECTED_M5,
  MISSED_M4,
  YOUR_MOVE_8,
  OPP_LAST_SWAP,
  YOUR_LAST_SWAP,
  RESIGN_SLIP,
  SCORED_M4,
  SCORED_WORD,
  SCORING_M4,
  TIME_UP,
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
  shakeAt?: Coordinate;
}

const isPicked = (marks: FieldMarks, at: Coordinate) => marks.picked !== undefined && same(marks.picked, at);

function markedState(marks: FieldMarks, at: Coordinate, base: CellState): CellState {
  return isPicked(marks, at) ? "picked" : base;
}

function markedSeat(marks: FieldMarks, at: Coordinate): Seat | null {
  return isPicked(marks, at) ? "you" : null;
}

/** The match field with the played moves drawn as bands and one phase's marks on it. */
function MatchField({ drawnCount, marks, turnFrame, disabled, bands = BANDS, frozenTiles = FIXTURE_FROZEN, ticks }: { drawnCount: number | null; marks: FieldMarks; turnFrame: Seat | null; disabled: boolean; bands?: typeof BANDS; frozenTiles?: typeof FIXTURE_FROZEN; ticks?: MatchPhaseSpec["ticks"] }) {
  return (
    <Field
          language="is"
      board={FIXTURE_BOARD}
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
      onActivate={NO_OP}
      ticks={ticks}
    />
  );
}

interface SeatOptions {
  completed: boolean;
  reconnectMsLeft: number | null;
  goneForMs?: number | null;
  /** Your own transport has lost the match. */
  offline?: boolean;
  /** Both players' moves and totals in this phase. */
  you?: { moves: number; score: number; scoring?: boolean };
  opp?: { moves: number; score: number; scoring?: boolean };
  lines: { you: string; opp: string };
}

function matchSeats({ completed, reconnectMsLeft, goneForMs = null, offline = false, you = { moves: 3, score: 46 }, opp = { moves: 6, score: 15 }, lines }: SeatOptions) {
  return {
    you: {
      name: BIRNA.displayName,
      rating: BIRNA.eloRating ?? null,
      movesPlayed: you.moves,
      scoring: you.scoring,
      score: you.score,
      offline,
      finalLine: completed ? lines.you : undefined,
    },
    opp: {
      name: KARI.displayName,
      rating: KARI.eloRating ?? null,
      movesPlayed: opp.moves,
      scoring: opp.scoring,
      score: opp.score,
      reconnectMsLeft,
      goneForMs,
      finalLine: completed ? lines.opp : undefined,
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
  /** Starting: ms until the clock runs. */
  msToStart?: number;
  /** Over: how long the match ran. */
  elapsedMs?: number;
  /** Spec 068: what else claims the live row's second line. */
  extras?: Line2Extras;
  /** Spec 068: the last-moved ticks on the field. */
  ticks?: Array<{ at: Coordinate; seat: Seat; name: string }>;
}

const IDLE: MatchPhaseSpec = { live: { kind: "idle" }, marks: {}, moveState: YOUR_MOVE };
const PICKING: MatchPhaseSpec = { live: PICKED_LIVE, marks: { picked: PICKED_CELL }, moveState: YOUR_MOVE };
const DONE_SEATS = { you: { moves: 10, score: 134 }, opp: { moves: 8, score: 88 } };

type TablePhase = "table" | "table-seated" | "void" | "void-queue" | "table-link-waits";
type MatchPhase = Exclude<RoomPhase, "profile" | "rules" | TablePhase | ReviewPhase>;

/** Every match-state phase as literals (spec 047 amendment P2, spec 050). */
const MATCH_PHASES: Record<MatchPhase, MatchPhaseSpec> = {
  idle: IDLE,
  picking: PICKING,
  "phone-sheet": PICKING,
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
  final: { live: { kind: "idle" }, marks: {}, state: FINAL_STATE, seats: DONE_SEATS, clockMs: FINAL_CLOCK_MS, elapsedMs: FINAL_ELAPSED_MS },
  disconnect: { live: { kind: "idle" }, marks: {}, moveState: YOUR_MOVE, state: DISCONNECT_STATE },
  resign: IDLE,
  leave: IDLE,
  "end-early": { live: { kind: "idle" }, marks: {}, moveState: DONE, clockMs: 72_000, state: { ...DISCONNECT_STATE, ...DONE_STATE, disconnectedPlayerId: OPP_ID }, seats: DONE_SEATS },
  "over-slip": { live: { kind: "idle" }, marks: {}, state: FINAL_STATE, seats: DONE_SEATS, clockMs: FINAL_CLOCK_MS, elapsedMs: FINAL_ELAPSED_MS },
  ...(Object.fromEntries(
    RESULT_PHASES.map((p) => [p, { live: { kind: "idle" }, marks: {}, state: resultState(p), seats: DONE_SEATS, clockMs: FINAL_CLOCK_MS, elapsedMs: FINAL_ELAPSED_MS }]),
  ) as Record<(typeof RESULT_PHASES)[number], MatchPhaseSpec>),
  ...(Object.fromEntries(
    REMATCH_PHASES.map((p) => [p, { live: { kind: "idle" }, marks: {}, state: resultState("result-moves"), seats: DONE_SEATS, clockMs: FINAL_CLOCK_MS, elapsedMs: FINAL_ELAPSED_MS }]),
  ) as Record<(typeof REMATCH_PHASES)[number], MatchPhaseSpec>),
  // Spec 068 (Phase B): the missed beat held, the stakes under a minute, pick cleared on line 2, the ticks.
  missed: { live: { kind: "idle" }, marks: {}, moveState: MISSED_M4, holdMove: HOLD_MOVE, seats: { you: { moves: 4, score: 41 } } },
  stakes: { live: { kind: "idle" }, marks: {}, moveState: YOUR_MOVE_8, clockMs: LOW_CLOCK_MS, seats: { you: { moves: 7, score: 69 }, opp: { moves: 9, score: 41 } }, extras: { stakes: { movesLeft: 3, penalty: -15 } } },
  "pick-cleared": { ...IDLE, extras: { pickClearedBy: KARI.displayName } },
  // Artboard Disconnect: you have ten at 1:12, Kári gone for 2:04 after you chose keep waiting.
  gone: { live: { kind: "idle" }, marks: {}, moveState: { kind: "done", opponentName: KARI.displayName, opponentMoves: 8, clockMmSs: "1:12" }, clockMs: 72_000, state: { ...DISCONNECT_STATE, ...DONE_STATE, disconnectedPlayerId: OPP_ID }, seats: DONE_SEATS, extras: { endEarlyOffer: KARI.displayName } },
  offline: { ...IDLE, extras: { offline: true } },
  "last-moved": {
    ...IDLE,
    ticks: [...OPP_LAST_SWAP.map((at) => ({ at, seat: "opp" as const, name: KARI.displayName })), ...YOUR_LAST_SWAP.map((at) => ({ at, seat: "you" as const, name: BIRNA.displayName }))],
  },
  // Spec 068: before started_at the clock row loads and both rows read `ready`; no pick is taken.
  starting: { live: { kind: "idle" }, marks: {}, moveState: { kind: "starting", seconds: 2, opponentName: KARI.displayName }, msToStart: MS_TO_START, clockMs: 300_000, seats: { you: { moves: 0, score: 0 }, opp: { moves: 0, score: 0 } } },
};

/** The slip each phase seeds (spec 048 contracts/fixture-phases.md). */
function slipFor(phase: RoomPhase, copy: Copy): SlipState | undefined {
  const slips: Partial<Record<RoomPhase, SlipState>> = {
    resign: RESIGN_SLIP,
    "end-early": END_EARLY_SLIP,
    leave: LEAVE_SLIP,
    "over-slip": overSlip(copy),
  };
  if (isRematchPhase(phase)) return rematchSlip(phase, copy);
  return isResultPhase(phase) ? resultSlip(phase, copy) : slips[phase];
}

/** The store phase each fixture phase seeds; everything not listed is a match state. */
const REVIEW_PHASES = ["review", "review-refused", "review-time", "review-public", "rematch-in-review"] as const;
function isReviewPhase(phase: string): phase is ReviewPhase {
  return (REVIEW_PHASES as readonly string[]).includes(phase);
}

const STORE_PHASE: Partial<Record<RoomPhase, StorePhase>> = {
  profile: "lobby",
  final: "final",
  "over-slip": "final",
  ...Object.fromEntries([...RESULT_PHASES, ...REMATCH_PHASES, ...REVIEW_PHASES].map((p) => [p, "final" as const])),
};

/** The room for one phase, from `fixtures.ts` alone (spec 045 US1). */
export function RoomFixture({ phase }: { phase: Exclude<RoomPhase, "rules"> }) {
  const copy = useCopy();
  const { language } = useLocale();
  const { OPPONENT, TAP_SECOND_LETTER, startsIn, searchingSubline, settingField } = copy;
  const [revealed, setRevealed] = useState<number | null>(phase === "reveal" ? 0 : null);

  useEffect(() => {
    // Seed the store so components reading it (Room's data-phase, seat colours)
    // agree with the props. No transport, no timers.
    const store = useRoomStore.getState();
    store.setViewer(BIRNA);
    store.setBoard(FIXTURE_BOARD);
    store.setPhase(STORE_PHASE[phase] ?? "match");
    const slip = slipFor(phase, copy);
    // Slips rank; a fixture shows exactly its own, so the previous one goes first.
    if (store.slip) store.clearSlip(store.slip.kind);
    if (slip) useRoomStore.getState().setSlip(slip);
  }, [phase, copy, language]);

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
        {/* A page since spec 070: the frame gives it the masthead and the one main. */}
        <PageFrame variant="signedIn" place="profile" viewer={{ displayName: BIRNA.displayName, handle: BIRNA.username }} otherLobbyHere={null}>
          <ProfilePage profile={profile} words={[...PROFILE_FIXTURE.bestWords]} matches={RECENT_GAMES} isSelf />
        </PageFrame>
      </RoomShell>
    );
  }



  if (isReviewPhase(phase)) return <ReviewFixture phase={phase} />;

  if (phase === "table" || phase === "table-seated" || phase === "void" || phase === "void-queue" || phase === "table-link-waits") {
    return <TableFixture phase={phase} copy={copy} />;
  }

  const result = isResultPhase(phase) ? phase : isRematchPhase(phase) ? "result-moves" : null;
  const completed = phase === "final" || phase === "over-slip" || result !== null;
  const disconnected = phase === "disconnect" || phase === "end-early";
  const spec = MATCH_PHASES[phase];
  const state = spec.state ?? MATCH_STATE;
  const gone = phase === "end-early" || phase === "gone";
  const seats = matchSeats({ completed, reconnectMsLeft: disconnected || gone ? (gone ? 0 : RECONNECT_MS_LEFT) : null, goneForMs: gone ? GONE_FOR_MS : null, offline: phase === "offline", ...spec.seats, lines: finalLines(copy) });
  const words = spec.liveWord ? [...FIXTURE_WORDS, spec.liveWord] : FIXTURE_WORDS;
  const bands = spec.liveWord === SCORED_WORD ? SCORING_BANDS : spec.liveWord === OPP_REVEAL_WORD ? OPP_REVEAL_BANDS : BANDS;
  const drawnCount = phase === "reveal" ? revealed : null;
  const locked = spec.holdMove !== undefined || ["scoring", "done", "timeUp", "starting"].includes(spec.moveState?.kind ?? "");

  return (
    <RoomShell viewer={BIRNA}>
      <MatchRoomView
        matchId={state.matchId}
        viewerSlot="player_a"
        you={seats.you}
        opp={seats.opp}
        clockMs={spec.clockMs ?? CLOCK_MS}
        clockLengthMs={300_000}
        msToStart={spec.msToStart}
        elapsedMs={spec.elapsedMs}
        moveLimit={10}
        completed={completed}
        words={words}
        playerAId={YOU_ID}
        frozenTiles={FIXTURE_FROZEN}
        live={spec.live}
        moveState={spec.moveState}
        line2Extras={spec.extras}
        holdMove={spec.holdMove ?? null}
        verdict={result ? resultVerdict(result, copy) : completed ? finalVerdict(copy) : undefined}
        caption={completed ? copy.finalContext("4:52") : undefined}
        notices={[]}
        hint={disconnected ? `${KARI.displayName} · ${OPPONENT}` : undefined}
        onAction={NO_OP}
      >
        <MatchField drawnCount={drawnCount} marks={spec.marks} turnFrame={spec.moveState ? turnFrameFor(spec.moveState) : null} disabled={completed || locked} bands={bands} ticks={spec.ticks} />
      </MatchRoomView>
    </RoomShell>
  );
}

function tableFixtureState(phase: TablePhase) {
  const seated = { a: "2026-09-23T12:00:01.000Z", b: null };
  if (phase === "table") return tableState({ a: null, b: null });
  if (phase === "table-seated") return tableState(seated);
  // Spec 072: the table waits for the link's sender until the link would have expired.
  if (phase === "table-link-waits") return tableState(seated, { table: { ...tableState(seated).table, origin: "link", deadlineAt: new Date(TABLE_NOW_MS + 552_000).toISOString() }, stakes: null });
  return voidState(phase === "void" ? "challenge" : "queue");
}

/** Spec 069 (canvas Table, Void): the table and the void, over the empty ruled field. */
function TableFixture({ phase, copy }: { phase: TablePhase; copy: Copy }) {
  const state = tableFixtureState(phase);
  const voided = phase === "void" || phase === "void-queue";
  const derived = tableSlipFor({ match: state, viewerSlot: "player_a", you: { name: BIRNA.displayName, rating: BIRNA.eloRating ?? null }, opp: { name: KARI.displayName, rating: KARI.eloRating ?? null }, nowMs: TABLE_NOW_MS, copy });
  const slip = derived?.kind === "void" && phase === "void-queue" ? { ...derived, model: { ...derived.model, searching: `${copy.SEARCHING} · ${VOID_SEARCHING_ELAPSED}` } } : derived;
  const seats = matchSeats({ completed: false, reconnectMsLeft: null, you: { moves: 0, score: 0 }, opp: { moves: 0, score: 0 }, lines: finalLines(copy) });
  return (
    <RoomShell viewer={BIRNA}>
      <MatchRoomView
        matchId={state.matchId}
        viewerSlot="player_a"
        you={seats.you}
        opp={seats.opp}
        clockMs={300_000}
        clockLengthMs={300_000}
        moveLimit={10}
        completed={false}
        words={[]}
        playerAId={YOU_ID}
        frozenTiles={{}}
        live={{ kind: "idle" }}
        moveState={{ kind: voided ? "void" : "table", opponentName: KARI.displayName }}
        holdMove={null}
        caption={voided ? copy.table.VOID_LABEL : copy.table.CONTEXT}
        notices={[]}
        table={tableFacts(state, "player_a")}
        tableSlip={slip}
        onAction={NO_OP}
      >
        <Field language="is" board={BLANK_BOARD as string[][]} viewerSlot="player_a" disabled onActivate={NO_OP} />
      </MatchRoomView>
    </RoomShell>
  );
}

export const FIXTURE_OPPONENT_ID = OPP_ID;
