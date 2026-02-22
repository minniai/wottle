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
  /** True if this word was already scored by this player in a prior round (0 points). */
  isDuplicate?: boolean;
}

export interface RoundSummary {
  matchId: string;
  roundNumber: number;
  words: WordScore[];
  deltas: ScoreTotals;
  totals: ScoreTotals;
  /** Combo bonus per player (included in deltas). Shown in UI for transparency. */
  comboBonus?: ScoreTotals;
  highlights: Coordinate[][];
  resolvedAt: string;
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

// ─── Frozen Tile Types (003-word-engine-scoring) ──────────────────────

export type FrozenTileOwner = "player_a" | "player_b" | "both";

export interface FrozenTile {
  owner: FrozenTileOwner;
}

/** Keys are "x,y" coordinate strings. Values indicate ownership. */
export type FrozenTileMap = Record<string, FrozenTile>;

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
  /** lettersPoints + lengthBonus (0 if duplicate) */
  totalPoints: number;
  /** True if word was scored by this player in a prior round */
  isDuplicate: boolean;
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
  /** Combo bonuses per player */
  comboBonus: { playerA: number; playerB: number };
  /** Score deltas for this round */
  deltas: ScoreTotals;
  /** Updated frozen tile map (merged with existing) */
  newFrozenTiles: FrozenTileMap;
  /** True if the 24-unfrozen minimum prevented full tile freezing (FR-016) */
  wasPartialFreeze: boolean;
  /** Total pipeline duration in milliseconds */
  durationMs: number;
}
