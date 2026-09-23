import type { Language } from "@/lib/types/game-config";
import type { BoardGrid, Coordinate } from "./board";

// Re-export Coordinate for convenience
export type { Coordinate };

export type LobbyStatus = "available" | "matchmaking" | "in_match" | "offline";

export interface PlayerIdentity {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: LobbyStatus;
  lastSeenAt: string;
  eloRating?: number | null;
  /** ISO timestamp — when the player row was first created. Optional so
   *  existing lobby/presence loaders that don't fetch it stay compatible. */
  createdAt?: string;
}

export type MatchPhase = "pending" | "in_progress" | "completed" | "abandoned";

export interface ScoreTotals {
  playerA: number;
  playerB: number;
}

export type MatchEndedReason =
  /** Spec 050: both players made ten moves; score, then exclusive frozen tiles, then draw. */
  | "moves_complete"
  /** Spec 050: one player was short of ten moves at the deadline; the other wins. */
  | "incomplete"
  /** Spec 050: both were short of ten; a draw. */
  | "both_incomplete"
  | "disconnect"
  | "forfeit"
  | "abandoned"
  | "error"
  /** Spec 069: the table did not fill, or a player left it before go. Nothing is rated. */
  | "void";

// ─── Moves (spec 050) ────────────────────────────────────────────────

/** Why a move was refused at receipt (never recorded). */
export type MoveRefusalReason =
  | "not_found"
  | "not_participant"
  | "ended"
  | "not_started"
  | "deadline"
  | "cap"
  | "in_flight";

/** Why a received move was rejected at resolution (recorded; not counted). */
export type MoveRejectionReason = "frozen" | "moved";

/** What the server broadcasts as `move-resolved` when a move finishes (contracts/move-resolved-event.md). */
export interface MoveResolution {
  matchId: string;
  moveId: string;
  playerId: string;
  /** Receipt order; the ordering authority. */
  globalSeq: number;
  /** The player's Nth resolved move; null when rejected. */
  seq: number | null;
  status: "resolved" | "rejected";
  rejectionReason?: MoveRejectionReason;
  swap: { from: Coordinate; to: Coordinate };
  /** The board after the move; unchanged when rejected. */
  board: BoardGrid;
  words: WordScore[];
  delta: number;
  totals: ScoreTotals;
  frozenTiles: FrozenTileMap;
  movesPlayed: { playerA: number; playerB: number };
  resolvedAt: string;
}

/** One player's facts in `MatchState` (contracts/match-state.md). */
export interface PlayerMatchFacts {
  playerId: string;
  movesPlayed: number;
  score: number;
  inFlight: { moveId: string; globalSeq: number; receivedAt: string } | null;
  lastResolution: MoveResolution | null;
}

/** The one shared clock; `serverNow` anchors the client's countdown. */
export interface MatchClock {
  startedAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
}

export type ClockCheckResult = { allowed: true } | { allowed: false; remainingMs: number };

/** Top-scoring word for displaying in the post-game summary screen. */
export interface TopWord {
  word: string;
  totalPoints: number;
  lettersPoints: number;
  bonusPoints: number;
}

/**
 * Broadcast-facing word score type used in round summaries.
 *
 * `bonusPoints` here corresponds to `lengthBonus` in `WordScoreBreakdown`
 * and `bonus_points` in the `word_score_entries` DB column.
 * All three refer to the same value: (word_length - 2) * 5.
 */
/** Direction a scored word reads on the field (rules §3.1); chevron sits at coordinates[0]. */
export type ReadingDirection = "ltr" | "rtl" | "ttb" | "btt";

export interface WordScore {
  playerId: string;
  word: string;
  length: number;
  lettersPoints: number;
  bonusPoints: number;
  totalPoints: number;
  /** Ordered from the reading start; `coordinates[0]` is where the chevron sits. */
  coordinates: Coordinate[];
  /** Derived from `coordinates` by the row mapper; absent on legacy payloads (spec 044). */
  direction?: ReadingDirection;
}

/** The room's snapshot (spec 050, contracts/match-state.md); `state` broadcast and `GET /api/match/[id]/state`. */
export interface MatchState {
  matchId: string;
  /**
   * `matches.board`: the live board, rewritten by every resolved move. Null
   * until both players are seated (spec 069 FR-003): the letters never leave
   * the server before the table fills.
   */
  board: string[][] | null;
  state: MatchPhase;
  players: {
    playerA: PlayerMatchFacts;
    playerB: PlayerMatchFacts;
  };
  clock: MatchClock;
  moveLimit: number;
  /** Spec 060: the game language — dictionary, letter values, letter frequencies. Fixed at creation. */
  language: Language;
  /** The last receipt sequence finished; the client's idempotency key for resolutions. */
  resolvedSeq: number;
  scores: ScoreTotals;
  disconnectedPlayerId?: string | null;
  /** ISO timestamp when `disconnectedPlayerId` was first observed server-side (spec 044). */
  disconnectedAt?: string | null;
  /** Length of the reconnection window in ms (RECONNECT_WINDOW_MS). */
  reconnectWindowMs?: number;
  /** Frozen tile map for visual rendering and swap validation */
  frozenTiles: FrozenTileMap;
  /**
   * Set once the match is completed. A win can be forced (a resignation, a
   * disconnect past the window), in which case the totals do not name the
   * winner and the verdict must read these instead (spec 048 US1).
   */
  winnerId?: string | null;
  endedReason?: MatchEndedReason | null;
  /** Set once completed; with `clock.startedAt` it gives the match's duration. */
  completedAt?: string | null;
  /** Spec 069: the table, from creation to go, and the void if it never filled. */
  table: MatchTable;
  /** Spec 069: each player's rating change for a win, a draw and a loss; read while pending only. */
  stakes: Record<string, Stakes> | null;
}

// ─── The table (spec 069) ────────────────────────────────────────────

export type SeatKey = "a" | "b";

export type TableOrigin =
  | "queue"
  | "challenge"
  | "crossed_challenge"
  | "rematch"
  | "crossed_rematch"
  | "link";

export type VoidReason = "not_seated" | "left";

export interface MatchTable {
  /** ISO time each seat was taken, or null while that player has not sat down. */
  seats: Record<SeatKey, string | null>;
  /** `table_deadline_at`: the time to sit down. */
  deadlineAt: string | null;
  origin: TableOrigin | null;
  /** The previous match of a rematch table, for the void slip's `result ▸`. */
  rematchOf: string | null;
  voidReason: VoidReason | null;
  voidedBy: string | null;
}

export interface Stakes {
  win: number;
  draw: number;
  loss: number;
}

export type PlayerSlot = "player_a" | "player_b";

export interface LobbyPresence {
  playerId: string;
  connectionId: string;
  mode: "auto" | "direct_invite";
  inviteToken?: string | null;
  expiresAt: string;
}

export interface MatchLogEvent {
  id: string;
  matchId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface InvitationRecord {
  id: string;
  senderId: string;
  recipientId: string;
  status: "pending" | "accepted" | "declined" | "expired" | "withdrawn" | "superseded";
  createdAt: string;
  respondedAt?: string | null;
  matchId?: string | null;
}

export interface MoveVector {
  from: Coordinate;
  to: Coordinate;
}

export function buildMoveSignature(vector: MoveVector): string {
  const from = `${vector.from.x},${vector.from.y}`;
  const to = `${vector.to.x},${vector.to.y}`;
  return `${from}->${to}`;
}

// ─── Move Types ───────────────────────────────────────────────────────

/** A move accepted after conflict resolution. */
export interface AcceptedMove {
  playerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** ISO timestamp for scoring precedence ordering (FR-005). Required from Phase 6. */
  submittedAt?: string;
}

// ─── Frozen Tile Types (003-word-engine-scoring) ──────────────────────

export type FrozenTileOwner = "player_a" | "player_b";

export type ScoredAxis = "horizontal" | "vertical";

export interface FrozenTile {
  owner: FrozenTileOwner;
  /** Which axis(es) this tile was scored on. Absent for legacy data. */
  scoredAxes?: ScoredAxis[];
}

/** Keys are "x,y" coordinate strings. Values indicate ownership. */
export type FrozenTileMap = Record<string, FrozenTile>;

// ─── Rematch Types (016-rematch-post-game-loop) ──────────────────────

export type RematchRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  /** Spec 067: its requester started another match, or its responder was booked into one. */
  | "withdrawn"
  | "superseded";

export interface RematchRequest {
  id: string;
  matchId: string;
  requesterId: string;
  responderId: string;
  status: RematchRequestStatus;
  newMatchId: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export type RematchEventType =
  | "rematch-request"
  | "rematch-accepted"
  | "rematch-declined"
  | "rematch-expired";

export interface RematchEvent {
  type: RematchEventType;
  matchId: string;
  requesterId: string;
  status: RematchRequestStatus;
  newMatchId?: string;
}

export interface SeriesContext {
  gameNumber: number;
  /** Wins for the current player in the series. */
  currentPlayerWins: number;
  /** Wins for the opponent in the series. */
  opponentWins: number;
  draws: number;
}

// ─── Elo Rating Types (017-elo-rating-player-stats) ───────────────────

export interface EloCalculationInput {
  playerRating: number;
  opponentRating: number;
  /** 1.0 = win, 0.5 = draw, 0.0 = loss */
  actualScore: number;
  /** 32 for new players (<20 games), 16 for established */
  kFactor: number;
}

export interface EloCalculationResult {
  newRating: number;
  delta: number;
  expectedScore: number;
}

export interface MatchRatingResult {
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  kFactor: number;
  matchResult: "win" | "loss" | "draw";
}

export interface PlayerStats {
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  /** wins / (wins + losses), null if no decisive games */
  winRate: number | null;
}

export interface BestWord {
  word: string;
  points: number;
  /** Opponent in the match where it scored (profile `best words` ledger). */
  opponentName?: string;
}

export type MatchResult = "W" | "L" | "D";

export interface RatingHistoryEntry {
  /** ISO timestamp */
  recordedAt: string;
  rating: number;
}

export interface PlayerProfile {
  identity: PlayerIdentity;
  stats: PlayerStats;
  /** Last 5 rating_after values, oldest first */
  ratingTrend: number[];
  /** Highest-points word this player has ever scored (null if they never scored one) */
  bestWord: BestWord | null;
  /** Last 10 match outcomes, newest first */
  form: MatchResult[];
  /** Max rating_after across all match_ratings (falls back to current eloRating) */
  peakRating: number;
  /** Full rating history oldest → newest */
  ratingHistory: RatingHistoryEntry[];
}

export interface RatingChange {
  playerADelta: number;
  playerBDelta: number;
  playerARatingAfter: number;
  playerBRatingAfter: number;
}

// ─── Lobby UI Types (019-lobby-visual-foundation) ─────────────────────

/** Response shape for GET /api/lobby/stats/matches-in-progress. */
export interface LobbyMatchesStats {
  matchesInProgress: number;
}

// ─── Match Player Profiles (018-match-hud-layout) ─────────────────────

/** Snapshot of player identity for display during an active match. */
export interface MatchPlayerProfile {
  playerId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  eloRating: number;
  /** Completed matches; 0 → the first-match rules line shows (spec 044, Clarifications Q2). */
  gamesPlayed?: number;
}

/** Both players' profiles for the match UI. */
export interface MatchPlayerProfiles {
  playerA: MatchPlayerProfile;
  playerB: MatchPlayerProfile;
}

// ─── Scoring Breakdown Types (003-word-engine-scoring) ────────────────

/**
 * Detailed scoring breakdown for a single word in a round.
 *
 * Naming note: `lengthBonus` here maps to `bonus_points` in the
 * `word_score_entries` DB column and `bonusPoints` in the `WordScore`
 * broadcast type. All three refer to the same value: (word_length - 2) * 5.
 */
export interface WordScoreBreakdown {
  /** The word text (lowercase) */
  word: string;
  /** Number of letters */
  length: number;
  /** Sum of LETTER_SCORING_VALUES_IS for each character */
  lettersPoints: number;
  /** Length bonus: (word_length - 2) * 5 */
  lengthBonus: number;
  /** lettersPoints + lengthBonus */
  totalPoints: number;
  /** Ordered tile coordinates */
  tiles: Coordinate[];
  /** Player who formed this word */
  playerId: string;
}

