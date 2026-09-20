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
 * previewed, played, opp-played, low-clock, illegal — and `phone-sheet`, which
 * the visual spec opens at 390×844.
 */

import type { AccumulatedWord, LiveState } from "@/lib/room/ledgerRows";
import type { SlipState } from "@/lib/room/slip";
import type { RoundState } from "@/lib/room/roundState";
import type { Coordinate } from "@/lib/types/board";
import type { Territory, Verdict } from "@/lib/room/ledgerTypes";
import type { FrozenTileMap, MatchState, PlayerIdentity } from "@/lib/types/match";
import type { RecentGameRow } from "@/lib/types/lobby";

export const ROOM_PHASES = [
  "landing-slip",
  "lobby",
  "queue",
  "found",
  "idle",
  "picking",
  "previewed",
  "played",
  "opp-played",
  "low-clock",
  "illegal",
  "reveal",
  "final",
  "disconnect",
  "profile",
  "phone-sheet",
  // Spec 048: the four slips and the settle hold, one phase each.
  "resign",
  "claim-win",
  "over-slip",
  "settle",
  "rules",
] as const;

export type RoomPhase = (typeof ROOM_PHASES)[number];

export function isRoomPhase(value: string | undefined): value is RoomPhase {
  return ROOM_PHASES.includes((value ?? "") as RoomPhase);
}

/**
 * ÞAKREISTÖL
 * GÆFUNDIRÓM
 * SKBORÐTÝUN   BORÐ  you  R1  ltr  x 2–5, y 2
 * ÁLNIRÖSKUM
 * EYÐIHVAGTL   GILT  opp  R2  ttb  x 7, y 4–7
 * RÚNTÆKSIÐÓ
 * ÖFLUGRÁLEK   LEK   you  R3  ltr  x 7–9, y 6  — crosses GILT at (7,6); the L is Kári's
 * MÝSJAÐETRI
 * ISKÓPUNÆHÖ
 * TRAUÐLEGIS   T at x 0, y 9 is picked in the picking phase
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

/** Rounds 1–3, scored. Round 4 is live in the `match` phase. */
export const FIXTURE_WORDS: AccumulatedWord[] = [
  {
    roundNumber: 1,
    playerId: YOU_ID,
    word: "BORÐ",
    totalPoints: 22,
    coordinates: coords([[2, 2], [3, 2], [4, 2], [5, 2]]),
    direction: "ltr",
  },
  {
    roundNumber: 2,
    playerId: OPP_ID,
    word: "GILT",
    totalPoints: 15,
    coordinates: coords([[7, 4], [7, 5], [7, 6], [7, 7]]),
    direction: "ttb",
  },
  {
    // Crosses GILT at (7, 6): Kári froze the L first, so it keeps his colour and
    // LEK's band covers (8,6) and (9,6) only (spec 049 US2).
    roundNumber: 3,
    playerId: YOU_ID,
    word: "LEK",
    totalPoints: 9,
    coordinates: coords([[7, 6], [8, 6], [9, 6]]),
    direction: "ltr",
  },
];

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

/** 4:12 and 2:31 of a 5:00 budget — two visibly different lane lengths. */
export const YOU_CLOCK_MS = 252_000;
export const OPP_CLOCK_MS = 151_000;

export const MATCH_STATE: MatchState = {
  matchId: "fixture-match",
  board: FIXTURE_BOARD,
  currentRound: 4,
  state: "collecting",
  timers: {
    playerA: { playerId: YOU_ID, remainingMs: YOU_CLOCK_MS, status: "running" },
    playerB: { playerId: OPP_ID, remainingMs: OPP_CLOCK_MS, status: "running" },
  },
  scores: { playerA: 46, playerB: 15 },
  frozenTiles: FIXTURE_FROZEN,
};

/** The picked letter in the picking phase: T at x 0, y 9, worth one point. */
export const PICKED_CELL: Coordinate = { x: 0, y: 9 };
export const PICKED_LIVE: LiveState = { kind: "picking", letter: "T", value: 1 };

/**
 * The preview phase: T (0,9) and Þ (0,0) exchanged. Priced once against the
 * real dictionary with `priceSwap` on this board: TAK across row 0, 10 points.
 */
export const PREVIEW_CELLS: [Coordinate, Coordinate] = [{ x: 0, y: 9 }, { x: 0, y: 0 }];
export const PREVIEW_LIVE: LiveState = { kind: "previewing", total: 10, words: ["tak"] };

/** Your played swap: two free letters pinned in your colour, your clock stopped. */
export const PLAYED_PINS: [Coordinate, Coordinate] = [{ x: 3, y: 5 }, { x: 6, y: 8 }];
/** The opponent's pending swap, seen from your seat: two coral pins, their clock stopped. */
export const OPP_PINS: [Coordinate, Coordinate] = [{ x: 1, y: 1 }, { x: 8, y: 3 }];

/** 0:48 of a 5:00 budget: the lane is 8px and blinks (design system §5.3). */
export const LOW_CLOCK_MS = 48_000;

/** An illegal pick: (7,4) is GILT's G, frozen by Kári in round 2. */
export const ILLEGAL_CELL: Coordinate = { x: 7, y: 4 };
export const ILLEGAL_LIVE: LiveState = { kind: "illegal", ownerName: "Kári", round: 2 };

export const DISCONNECT_STATE: MatchState = {
  ...MATCH_STATE,
  disconnectedPlayerId: OPP_ID,
  disconnectedAt: "2026-09-15T10:00:00.000Z",
  reconnectWindowMs: 90_000,
  timers: {
    playerA: { playerId: YOU_ID, remainingMs: YOU_CLOCK_MS, status: "paused" },
    playerB: { playerId: OPP_ID, remainingMs: OPP_CLOCK_MS, status: "paused" },
  },
};

/** ms left in the reconnection window, shown as `reconnecting · 0:42 left`. */
export const RECONNECT_MS_LEFT = 42_000;

export const FINAL_STATE: MatchState = {
  ...MATCH_STATE,
  currentRound: 10,
  state: "completed",
  scores: { playerA: 127, playerB: 170 },
  timers: {
    playerA: { playerId: YOU_ID, remainingMs: 41_000, status: "paused" },
    playerB: { playerId: OPP_ID, remainingMs: 12_000, status: "paused" },
  },
};

export const FINAL_VERDICT: Verdict = {
  winnerSeat: "opp",
  scoreLine: "Kári wins 170–127",
  detailLine: "by 43 points · 10 words to 8 · territory 32–25",
};

export const YOU_FINAL_LINE = "1204 → 1192 · −12 · loses";
export const OPP_FINAL_LINE = "1187 → 1199 · +12 · wins";

/** Spec 048 US2: the round's beat per phase, as literals. */
export const YOUR_MOVE: RoundState = { kind: "yourMove", round: 4, opponentName: KARI.displayName };
export const OPP_PLAYED: RoundState = { kind: "oppPlayed", round: 4, opponentName: KARI.displayName };
export const YOU_PLAYED: RoundState = { kind: "played", round: 4, opponentName: KARI.displayName };
export const RESOLVING_R3: RoundState = { kind: "resolving", round: 3, opponentName: KARI.displayName };
export const SCORED_R3: RoundState = { kind: "scored", round: 3, next: 4, you: 9, opp: 0, opponentName: KARI.displayName };
/** The settle hold: round 3 scored and held; round 4 not yet open (spec 048 FR-022). */
export const SETTLE_HOLD_ROUND = 3;

/** The three match slips (spec 048 §5.9), as literals. */
export const RESIGN_SLIP: SlipState = { kind: "resign", round: 4, clockMs: YOU_CLOCK_MS, opponentName: KARI.displayName };
export const CLAIM_WIN_SLIP: SlipState = { kind: "claimWin", opponentName: KARI.displayName, round: 4 };
export const OVER_SLIP: SlipState = {
  kind: "matchOver",
  verdict: FINAL_VERDICT,
  rounds: 10,
  durationMmSs: "18:50",
  scores: { you: 127, opp: 170 },
  viewerName: BIRNA.displayName,
  opponentName: KARI.displayName,
  ratings: [
    { seat: "opp", name: KARI.displayName, line: "1187 → 1199 · +12" },
    { seat: "you", name: `${BIRNA.displayName} · you`, line: "1204 → 1192 · −12" },
  ],
  rematch: "idle",
  readOnly: false,
};

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
