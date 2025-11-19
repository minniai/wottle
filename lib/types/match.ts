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

export interface WordScore {
  playerId: string;
  word: string;
  length: number;
  lettersPoints: number;
  bonusPoints: number;
  totalPoints: number;
  coordinates: Coordinate[];
}

export interface RoundSummary {
  matchId: string;
  roundNumber: number;
  words: WordScore[];
  deltas: ScoreTotals;
  totals: ScoreTotals;
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
