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

export interface LedgerRow {
  round: number;
  status: "past" | "live" | "future";
  you: SeatCell | null;
  opp: SeatCell | null;
  liveText?: string;
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
  rows: LedgerRow[];
  territory: Territory;
  hint: string;
  verdict?: Verdict;
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
  | { challenge: string };

export type Notice =
  | { kind: "frozen"; ownerName: string; round: number; expiresAt: number }
  | { kind: "pickCleared"; reason: "opponentPinned" | "frozen" }
  | { kind: "rematchRequest"; requesterName: string }
  | { kind: "resignConfirm"; expiresAt: number }
  | { kind: "firstMatchRules" }
  | { kind: "claimWin"; opponentName: string }
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
