/**
 * Static room fixtures (spec 045 US1, FR-001).
 *
 * Every room state, assembled from the existing types only — no interface is
 * declared here, because a fixture that needed its own type would prove the
 * fixture route is not rendering the real room.
 *
 * Every clock, count, rating and timestamp is a literal. Nothing reads
 * `Date.now()`, `Math.random()` or the system locale, or the reference images
 * would differ on every run.
 *
 * The board is the one the implementation review's companion renders, so a
 * screenshot of `?phase=picking` is directly comparable with its fixture B.
 *
 * Spec 047 amendment P2: one phase per asymmetric signal — idle, picking,
 * played, opp-played, low-clock, illegal — and `phone-sheet`, which
 * the visual spec opens at 390×844.
 */

import { copyEn } from "@/lib/i18n/copy/en";
import type { Copy } from "@/lib/i18n/copy/types";
import type { AccumulatedWord, LiveState } from "@/lib/room/ledgerRows";
import type { SlipState } from "@/lib/room/slip";
import type { MoveState } from "@/lib/room/moveState";
import type { Coordinate } from "@/lib/types/board";
import type { Territory, Verdict } from "@/lib/room/ledgerTypes";
import type { FrozenTileMap, MatchEndedReason, MatchState, MoveResolution, PlayerIdentity } from "@/lib/types/match";
import type { RecentGameRow } from "@/lib/types/lobby";
import { SEATED_TABLE } from "@/lib/match/table";
import { buildVerdict } from "@/lib/room/ledgerRows";

export const ROOM_PHASES = [
  // Spec 069: the table replaces the queue's own `found` moment; the void; a paused search.
  "table",
  "table-seated",
  "void",
  "void-queue",
  "idle",
  "picking",
  "illegal",
  "reveal",
  "final",
  "disconnect",
  "profile",
  "phone-sheet",
  // Spec 048: the slips, one phase each.
  "resign",
  "over-slip",
  "rules",
  // Spec 050: one phase per move beat and the low clock in the caption.
  "scoring",
  "scored",
  "opp-reveal",
  "rejected",
  "done-waiting",
  "time-up",
  "end-early",
  "low-clock",
  // The last 15 seconds (spec 068: weight only, nothing blinks).
  "last-seconds",
  // Spec 068: the scoreboard loading over the 3·2·1.
  "starting",
  // Spec 068 (Phase B): the missed beat, the stakes, pick cleared on line 2, the last-moved tick.
  "missed",
  "stakes",
  "pick-cleared",
  "last-moved",
  // Spec 068 (US8): the opponent gone past the window with the offer on line 2; your own outage.
  "gone",
  "offline",
  // Spec 070 (C7): Back in a live match; the leave slip never resigns.
  "leave",
  // Spec 071 (D1): the result slip, one phase per reason the match ended.
  "result-moves",
  "result-incomplete",
  "result-both",
  "result-forfeit",
  "result-early",
] as const;

export type RoomPhase = (typeof ROOM_PHASES)[number];

export function isRoomPhase(value: string | undefined): value is RoomPhase {
  return ROOM_PHASES.includes((value ?? "") as RoomPhase);
}

/**
 * ÞAKREISTÖL
 * GÆFUNDIRÓM
 * SKBORÐTÝUN   BORÐ  you  M1  ltr  x 2–5, y 2
 * ÁLNIRÖSKUM
 * EYÐIHVAGTL   GILT  opp  M1  ttb  x 7, y 4–7
 * RÚNTÆKSIÐÓ   TÆK   you  M4 (scoring / scored phases)  ltr  x 3–5, y 5
 * ÖFLUGRÁLEK   LEK   you  M3  ltr  x 7–9, y 6  — crosses GILT at (7,6); the L is Kári's
 * MÝSJAÐETRI
 * ISKÓPUNÆHÖ
 * TRAUÐLEGIS   T at x 0, y 9 is picked in the picking phase; LEG (opp M7) x 5–7, y 9 in opp-reveal
 */
export const FIXTURE_BOARD: string[][] = [
  [..."ÞAKREISTÖL"],
  [..."GÆFUNDIRÓM"],
  [..."SKBORÐTÝUN"],
  [..."ÁLNIRÖSKUM"],
  [..."EYÐIHVAGTL"],
  [..."RÚNTÆKSIÐÓ"],
  [..."ÖFLUGRÁLEK"],
  [..."MÝSJAÐETRI"],
  [..."ISKÓPUNÆHÖ"],
  [..."TRAUÐLEGIS"],
];

export const YOU_ID = "player-birna";
export const OPP_ID = "player-kari";

export const BIRNA: PlayerIdentity = {
  id: YOU_ID,
  username: "birna",
  displayName: "Birna",
  status: "available",
  lastSeenAt: "2026-09-15T10:00:00.000Z",
  eloRating: 1204,
};

export const KARI: PlayerIdentity = {
  id: OPP_ID,
  username: "kari",
  displayName: "Kári",
  status: "available",
  lastSeenAt: "2026-09-15T10:00:00.000Z",
  eloRating: 1187,
};

/** Others in the lobby directory, so the `here now` table has rows to show. */
export const LOBBY_PLAYERS: PlayerIdentity[] = [
  BIRNA,
  KARI,
  { id: "player-embla", username: "embla", displayName: "Embla", status: "available", lastSeenAt: "2026-09-15T09:58:00.000Z", eloRating: 1242 },
  { id: "player-jonas", username: "jonas", displayName: "Jónas", status: "in_match", lastSeenAt: "2026-09-15T09:59:00.000Z", eloRating: 1163 },
];

export const RECENT_GAMES: RecentGameRow[] = [
  { matchId: "m-101", result: "win", opponentId: "player-embla", opponentUsername: "embla", opponentDisplayName: "Embla", yourScore: 184, opponentScore: 150, wordsFound: 11, completedAt: "2026-09-14T19:12:00.000Z" },
  { matchId: "m-100", result: "loss", opponentId: "player-jonas", opponentUsername: "jonas", opponentDisplayName: "Jónas", yourScore: 132, opponentScore: 171, wordsFound: 7, completedAt: "2026-09-14T18:40:00.000Z" },
  { matchId: "m-099", result: "win", opponentId: OPP_ID, opponentUsername: "kari", opponentDisplayName: "Kári", yourScore: 166, opponentScore: 159, wordsFound: 9, completedAt: "2026-09-13T21:05:00.000Z" },
];

const coords = (cells: [number, number][]) => cells.map(([x, y]) => ({ x, y }));

/**
 * Spec 050: words by move. You (Birna) have played 3 moves (BORÐ, a blank, LEK);
 * Kári has played 6 (GILT and five blanks). Move 4 is yours to make.
 */
export const FIXTURE_WORDS: AccumulatedWord[] = [
  { moveSeq: 1, globalSeq: 1, playerId: YOU_ID, word: "BORÐ", totalPoints: 22, coordinates: coords([[2, 2], [3, 2], [4, 2], [5, 2]]), direction: "ltr" },
  { moveSeq: 1, globalSeq: 2, playerId: OPP_ID, word: "GILT", totalPoints: 15, coordinates: coords([[7, 4], [7, 5], [7, 6], [7, 7]]), direction: "ttb" },
  // Crosses GILT at (7, 6): Kári froze the L first, so it keeps his colour and
  // LEK's band covers (8,6) and (9,6) only (spec 049 US2).
  { moveSeq: 3, globalSeq: 8, playerId: YOU_ID, word: "LEK", totalPoints: 9, coordinates: coords([[7, 6], [8, 6], [9, 6]]), direction: "ltr" },
];

/** Your move 4 as it resolves in the scoring and scored phases: TÆK across row 5. */
export const SCORED_WORD: AccumulatedWord = { moveSeq: 4, globalSeq: 10, playerId: YOU_ID, word: "TÆK", totalPoints: 13, coordinates: coords([[3, 5], [4, 5], [5, 5]]), direction: "ltr" };
/** Kári's move 7 landing while you pick: LEG across row 9. */
export const OPP_REVEAL_WORD: AccumulatedWord = { moveSeq: 7, globalSeq: 10, playerId: OPP_ID, word: "LEG", totalPoints: 13, coordinates: coords([[5, 9], [6, 9], [7, 9]]), direction: "ltr" };

export const FIXTURE_FROZEN: FrozenTileMap = {
  "2,2": { owner: "player_a" },
  "3,2": { owner: "player_a" },
  "4,2": { owner: "player_a" },
  "5,2": { owner: "player_a" },
  "7,4": { owner: "player_b" },
  "7,5": { owner: "player_b" },
  "7,6": { owner: "player_b" },
  "7,7": { owner: "player_b" },
  "8,6": { owner: "player_a" },
  "9,6": { owner: "player_a" },
};

export const FIXTURE_TERRITORY: Territory = { you: 6, opp: 4, free: 90 };

/** The shared clock (spec 050): 3:12 left of 5:00 in the base phases. */
export const CLOCK_MS = 192_000;
/** Your and Kári's moves played in the base phases. */
export const YOU_MOVES = 3;
export const OPP_MOVES = 6;

const CLOCK = { startedAt: "2026-09-15T09:55:00.000Z", deadlineAt: "2026-09-15T10:00:00.000Z", serverNow: "2026-09-15T09:56:48.000Z" };

function facts(playerId: string, movesPlayed: number, score: number, lastResolution: MoveResolution | null = null) {
  return { playerId, movesPlayed, score, inFlight: null, lastResolution };
}

export const MATCH_STATE: MatchState = {
  matchId: "fixture-match",
  board: FIXTURE_BOARD,
  state: "in_progress",
  players: { playerA: facts(YOU_ID, YOU_MOVES, 46), playerB: facts(OPP_ID, OPP_MOVES, 15) },
  clock: CLOCK,
  moveLimit: 10,
  language: "is",
  resolvedSeq: 9,
  scores: { playerA: 46, playerB: 15 },
  frozenTiles: FIXTURE_FROZEN,
  table: SEATED_TABLE,
  stakes: null,
};

/** The picked letter in the picking phase: T at x 0, y 9, worth one point. */
export const PICKED_CELL: Coordinate = { x: 0, y: 9 };
export const PICKED_LIVE: LiveState = { kind: "picking", letter: "T", value: 1 };

/** 0:48 on the shared clock: the caption numeral is heavier and blinks (design system §5.4). */
export const LOW_CLOCK_MS = 48_000;
export const LAST_SECONDS_MS = 12_000;

/** An illegal pick: (7,4) is GILT's G, frozen by Kári with his first move. */
export const ILLEGAL_CELL: Coordinate = { x: 7, y: 4 };
export const ILLEGAL_LIVE: LiveState = { kind: "illegal", ownerName: "Kári", round: 1 };

export const DISCONNECT_STATE: MatchState = {
  ...MATCH_STATE,
  disconnectedPlayerId: OPP_ID,
  disconnectedAt: "2026-09-15T10:00:00.000Z",
  reconnectWindowMs: 90_000,
};

/** ms left in the reconnection window, shown as `reconnecting · 0:42 left`. */
export const RECONNECT_MS_LEFT = 42_000;
/** Spec 068: how long Kári has been gone once the window is spent (artboard Disconnect). */
export const GONE_FOR_MS = 124_000;
/** Spec 068: the final state's clock, 0:08 left of 5:00 after 4:52 (artboard MatchRail). */
export const FINAL_CLOCK_MS = 8_000;
export const FINAL_ELAPSED_MS = 292_000;
/** Spec 068: the start count, two seconds before the clock runs. */
export const MS_TO_START = 2_000;

/** Done: you have all ten (134), Kári is on his ninth (88); 0:48 left. */
export const DONE_STATE: MatchState = {
  ...MATCH_STATE,
  players: { playerA: facts(YOU_ID, 10, 134), playerB: facts(OPP_ID, 8, 88) },
  scores: { playerA: 134, playerB: 88 },
};

export const FINAL_STATE: MatchState = {
  ...MATCH_STATE,
  state: "completed",
  players: { playerA: facts(YOU_ID, 10, 134), playerB: facts(OPP_ID, 8, 88) },
  scores: { playerA: 134, playerB: 88 },
  winnerId: YOU_ID,
  endedReason: "incomplete",
  completedAt: "2026-09-15T09:59:52.000Z",
};

/** Spec 050: the finisher wins; the detail line says the count that decided it. Worded by the page (spec 060). */
export function finalVerdict(copy: Copy): Verdict {
  return {
    winnerSeat: "you",
    scoreLine: copy.verdictLine(BIRNA.displayName, 134, 88),
    detailLine: copy.incompleteDetail(KARI.displayName, 8),
  };
}

/** The final bars' rating lines: `1204 → 1216 · +12 · wins` and `1187 → 1175 · −12` in English. */
export function finalLines(copy: Copy): { you: string; opp: string } {
  return { you: copy.ratingSubline(1204, 1216, 12, true), opp: copy.ratingSubline(1187, 1175, -12, false) };
}

/** Spec 050: the viewer's beat per phase, as literals. */
export const YOUR_MOVE: MoveState = { kind: "yourMove", move: 4, opponentName: KARI.displayName };
export const SCORING_M4: MoveState = { kind: "scoring", move: 4, opponentName: KARI.displayName };
export const SCORED_M4: MoveState = { kind: "scored", move: 4, delta: 13, next: 5, opponentName: KARI.displayName };
/**
 * Spec 069 (canvas Table, Void): the table 14s before its 20s run out. Birna
 * has not sat down (table), or has (table-seated); Kári is on the way.
 */
export const TABLE_NOW_MS = Date.parse("2026-09-23T12:00:06.000Z");
export function tableState(seats: { a: string | null; b: string | null }, over: Partial<MatchState> = {}): MatchState {
  return {
    ...MATCH_STATE,
    board: null,
    state: "pending",
    players: { playerA: facts(YOU_ID, 0, 0), playerB: facts(OPP_ID, 0, 0) },
    clock: { startedAt: null, deadlineAt: null, serverNow: "2026-09-23T12:00:06.000Z" },
    resolvedSeq: 0,
    scores: { playerA: 0, playerB: 0 },
    frozenTiles: {},
    table: { ...SEATED_TABLE, seats, deadlineAt: "2026-09-23T12:00:20.000Z", origin: "queue" },
    stakes: { [YOU_ID]: { win: 8, draw: 0, loss: -8 }, [OPP_ID]: { win: 8, draw: 0, loss: -8 } },
    ...over,
  };
}
/** Spec 069 C3: Kári did not sit down; from a challenge (void) or the queue, Birna requeued (void-queue). */
export function voidState(origin: "queue" | "challenge"): MatchState {
  const seats = { a: "2026-09-23T12:00:01.000Z", b: null };
  return tableState(seats, { state: "completed", endedReason: "void", completedAt: "2026-09-23T12:00:20.000Z", table: { ...SEATED_TABLE, seats, deadlineAt: "2026-09-23T12:00:20.000Z", origin, voidReason: "not_seated", voidedBy: OPP_ID }, stakes: null });
}
export const VOID_SEARCHING_ELAPSED = "0:03";

/** Spec 068: your move 4 found no word; held as the missed beat. */
export const MISSED_M4: MoveState = { kind: "scored", move: 4, delta: -5, next: 5, missed: true, opponentName: KARI.displayName };
/** Spec 068 (artboard MatchLastMinute): your move 8 at 0:48, three moves left worth −15 at 0:00. */
export const YOUR_MOVE_8: MoveState = { kind: "yourMove", move: 8, opponentName: KARI.displayName };
/** Spec 068: each player's last swap, ticked in their colour (artboard Match). */
export const OPP_LAST_SWAP: Coordinate[] = [{ x: 4, y: 2 }, { x: 5, y: 2 }];
export const YOUR_LAST_SWAP: Coordinate[] = [{ x: 8, y: 0 }, { x: 8, y: 1 }];
export const REJECTED_M5: MoveState = { kind: "rejected", move: 5, opponentName: KARI.displayName, reason: "frozen" };
export const DONE: MoveState = { kind: "done", opponentName: KARI.displayName, opponentMoves: 8, clockMmSs: "0:48" };
export const TIME_UP: MoveState = { kind: "timeUp", opponentName: KARI.displayName };
/** The move hold: your move 4 scored and held; move 5 not yet open (spec 050 FR-013). */
export const HOLD_MOVE = 4;

/** The three match slips (spec 048 §5.9, spec 050), as literals. */
export const RESIGN_SLIP: SlipState = { kind: "resign", move: 4, clockMs: CLOCK_MS, opponentName: KARI.displayName };
export const LEAVE_SLIP: SlipState = { kind: "leave", move: 4, limit: 10, clockMs: CLOCK_MS };
export const END_EARLY_SLIP: SlipState = { kind: "endEarly", opponentName: KARI.displayName, opponentMoves: 8, clockMs: LOW_CLOCK_MS };
export function overSlip(copy: Copy): SlipState {
  return {
    kind: "matchOver",
    verdict: finalVerdict(copy),
    durationMmSs: "4:52",
    scores: { you: 134, opp: 88 },
    viewerName: BIRNA.displayName,
    opponentName: KARI.displayName,
    ratings: [
      { seat: "you", name: `${BIRNA.displayName} · ${copy.YOU}`, line: copy.ratingSubline(1204, 1216, 12, false) },
      { seat: "opp", name: KARI.displayName, line: copy.ratingSubline(1187, 1175, -12, false) },
    ],
    rematch: null,
    readOnly: false,
  };
}

export const OVER_SLIP: SlipState = overSlip(copyEn);

/** Spec 071 (D1): the result by the reason the match ended. Birna wins 134–88 each time. */
export const RESULT_PHASES = ["result-moves", "result-incomplete", "result-both", "result-forfeit", "result-early"] as const;
export type ResultPhase = (typeof RESULT_PHASES)[number];
const RESULT_FACTS: Record<ResultPhase, { reason: MatchEndedReason; you: number; opp: number }> = {
  "result-moves": { reason: "moves_complete", you: 10, opp: 10 },
  "result-incomplete": { reason: "incomplete", you: 10, opp: 8 },
  "result-both": { reason: "both_incomplete", you: 9, opp: 8 },
  "result-forfeit": { reason: "forfeit", you: 6, opp: 5 },
  "result-early": { reason: "ended_early", you: 10, opp: 6 },
};

export function isResultPhase(phase: string): phase is ResultPhase {
  return (RESULT_PHASES as readonly string[]).includes(phase);
}

export function resultState(phase: ResultPhase): MatchState {
  const f = RESULT_FACTS[phase];
  return { ...FINAL_STATE, endedReason: f.reason, players: { playerA: facts(YOU_ID, f.you, 134), playerB: facts(OPP_ID, f.opp, 88) } };
}

/** The verdict from the same function the room uses, so the fixture says what a match would. */
export function resultVerdict(phase: ResultPhase, copy: Copy): Verdict {
  const f = RESULT_FACTS[phase];
  return buildVerdict(
    {
      viewerName: BIRNA.displayName,
      opponentName: KARI.displayName,
      viewerScore: 134,
      opponentScore: 88,
      viewerWords: 10,
      opponentWords: 8,
      viewerMoves: f.you,
      opponentMoves: f.opp,
      territory: { you: 27, opp: 21, free: 52 },
      winnerSeat: "you",
      endedReason: f.reason,
      endClock: "3:12",
    },
    copy,
  );
}

export function resultSlip(phase: ResultPhase, copy: Copy): SlipState {
  return { ...(overSlip(copy) as Extract<SlipState, { kind: "matchOver" }>), verdict: resultVerdict(phase, copy), bestWord: { word: "borða", points: 29 } };
}

/** Queue: 58 of 100 placeholder letters have landed. */
export const QUEUE_LETTERS_LANDED = 58;
export const QUEUE_ELAPSED = "0:07";

export const PROFILE_FIXTURE = {
  player: BIRNA,
  rating: 1204,
  played: 34,
  won: 19,
  lost: 15,
  ratingHistory: [1188, 1176, 1193, 1201, 1190, 1208, 1215, 1199, 1186, 1197, 1216, 1204],
  bestWords: [
    { word: "BORÐA", points: 38 },
    { word: "GILTUR", points: 31 },
    { word: "SKÁLIN", points: 27 },
  ],
  recentMatches: RECENT_GAMES,
} as const;
