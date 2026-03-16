import type { Coordinate } from "./board";

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
}

export type TimerStatus = "running" | "paused" | "expired";

export interface TimerState {
  playerId: string;
  remainingMs: number;
  status: TimerStatus;
}

export type MatchPhase = "pending" | "collecting" | "resolving" | "completed" | "abandoned";

export interface ScoreTotals {
  playerA: number;
  playerB: number;
}

export type MatchEndedReason =
  | "round_limit"
  | "timeout"
  | "disconnect"
  | "forfeit"
  | "error";

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
export interface WordScore {
  playerId: string;
  word: string;
  length: number;
  lettersPoints: number;
  bonusPoints: number;
  totalPoints: number;
  coordinates: Coordinate[];
}

/** A player's accepted swap coordinates, included in round summaries for opponent move reveal. */
export interface RoundMove {
  playerId: string;
  from: Coordinate;
  to: Coordinate;
  /** ISO timestamp from move_submissions.created_at. Used to determine sequential reveal order. */
  submittedAt: string;
}

export interface RoundSummary {
  matchId: string;
  roundNumber: number;
  words: WordScore[];
  deltas: ScoreTotals;
  totals: ScoreTotals;
  highlights: Coordinate[][];
  resolvedAt: string;
  /** Accepted moves per player for opponent move reveal animation. */
  moves: RoundMove[];
}

export interface MatchState {
  matchId: string;
  board: string[][];
  currentRound: number;
  state: MatchPhase;
  timers: {
    playerA: TimerState;
    playerB: TimerState;
  };
  scores: ScoreTotals;
  lastSummary?: RoundSummary | null;
  disconnectedPlayerId?: string | null;
  /** Frozen tile map for visual rendering and swap validation */
  frozenTiles?: FrozenTileMap;
}

export type SubmissionStatus =
  | "pending"
  | "accepted"
  | "rejected_invalid"
  | "ignored_same_move"
  | "timeout";

export interface SubmissionRecord {
  playerId: string;
  status: SubmissionStatus;
  submittedAt?: string;
  signature?: string;
}

export type PlayerSlot = "player_a" | "player_b";

export interface RoundTracker {
  matchId: string;
  roundNumber: number;
  phase: "collecting" | "resolving" | "completed";
  submissions: Record<PlayerSlot, SubmissionRecord>;
}

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
  status: "pending" | "accepted" | "declined" | "expired";
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

export interface MoveSubmission {
  id?: string;
  match_id: string;
  player_id: string;
  round_number: number;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  created_at: string;
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
  | "expired";

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

export interface PlayerProfile {
  identity: PlayerIdentity;
  stats: PlayerStats;
  /** Last 5 rating_after values, oldest first */
  ratingTrend: number[];
}

export interface RatingChange {
  playerADelta: number;
  playerBDelta: number;
  playerARatingAfter: number;
  playerBRatingAfter: number;
}

// ─── Match Player Profiles (018-match-hud-layout) ─────────────────────

/** Snapshot of player identity for display during an active match. */
export interface MatchPlayerProfile {
  playerId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  eloRating: number;
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

/** Complete scoring result for a round. */
export interface RoundScoreResult {
  /** Per-word breakdowns for Player A */
  playerAWords: WordScoreBreakdown[];
  /** Per-word breakdowns for Player B */
  playerBWords: WordScoreBreakdown[];
  /** Score deltas for this round */
  deltas: ScoreTotals;
  /** Updated frozen tile map (merged with existing) */
  newFrozenTiles: FrozenTileMap;
  /** True if the 24-unfrozen minimum prevented full tile freezing (FR-016) */
  wasPartialFreeze: boolean;
  /** Total pipeline duration in milliseconds */
  durationMs: number;
}
