import type { Seat } from "@/lib/constants/seatColors";
import type { Coordinate } from "@/lib/types/board";
import type { ReadingDirection } from "@/lib/types/match";

/** Ledger model (spec 044 data-model §3.4). Pure data; built by lib/room/ledgerRows.ts. */
export interface WordCell {
  word: string;
  points: number;
  isDuplicate: boolean;
  coordinates: Coordinate[];
  direction: ReadingDirection;
}

export interface SeatCell {
  words: WordCell[];
  total: number;
}

/** The live row's two lines (spec 047 amendment P1): a state, then an instruction or nothing. */
export interface LiveLines {
  line1: string;
  line2: string;
}

export interface LedgerRow {
  round: number;
  /** `settled`: the scored round held as the tinted row before the next opens (spec 048 FR-022). */
  status: "past" | "live" | "future" | "settled";
  you: SeatCell | null;
  opp: SeatCell | null;
  live?: LiveLines;
  folded: boolean;
}

export interface Territory {
  you: number;
  opp: number;
  free: number;
}

export interface Verdict {
  winnerSeat: Seat | null;
  scoreLine: string;
  detailLine: string;
}

export interface LedgerModel {
  caption: string;
  /** The current round and whether the match is over: the rail's inputs (spec 048 US3). */
  round?: number;
  completed?: boolean;
  rows: LedgerRow[];
  territory: Territory;
  hint: string;
  verdict?: Verdict;
  /**
   * The queue's live line. Match and final carry theirs on the live `LedgerRow`;
   * the queue has no rows, so it had nowhere to put `setting the field · n of
   * 100 letters` and printed it in `hint` instead (spec 045 B7).
   */
  live?: string;
}

export type LedgerAction =
  | "rules"
  | "resign"
  | "confirmResign"
  | "cancelResign"
  | "leave"
  | "rematch"
  | "acceptRematch"
  | "declineRematch"
  | "newOpponent"
  | "lobby"
  | "cancelQueue"
  | "toggleSound"
  | "togglePreview"
  | "signOut"
  | "profile"
  | "claimWin"
  | "keepWaiting"
  | "keepPlaying"
  | "reviewField"
  | "result"
  | "howToPlay"
  | "playRanked"
  | { challenge: string }
  | { acceptChallenge: string }
  | { declineChallenge: string };

export type Notice =
  | { kind: "pickCleared"; reason: "opponentPinned" | "frozen" }
  | { kind: "rematchRequest"; requesterName: string }
  | { kind: "resignConfirm"; expiresAt: number }
  | { kind: "firstMatchRules" }
  | { kind: "claimWin"; opponentName: string }
  | { kind: "challenge"; fromName: string; inviteId: string }
  | { kind: "text"; text: string };

export const EMPTY_TERRITORY: Territory = { you: 0, opp: 0, free: 100 };

export function emptyRows(total = 10): LedgerRow[] {
  return Array.from({ length: total }, (_, i) => ({
    round: i + 1,
    status: "future" as const,
    you: null,
    opp: null,
    folded: false,
  }));
}
