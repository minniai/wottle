import type { Seat } from "@/lib/constants/seatColors";
import type { Coordinate } from "@/lib/types/board";
import type { ReadingDirection } from "@/lib/types/match";

/** Ledger model (spec 044 data-model §3.4, spec 050). Pure data; built by lib/room/ledgerRows.ts. */
export interface WordCell {
  word: string;
  points: number;
  coordinates: Coordinate[];
  direction: ReadingDirection;
}

/** One seat's Nth move: its words and their points. Empty words with total 0 is a move that scored nothing. */
export interface SeatCell {
  words: WordCell[];
  total: number;
  /** A move that scored no word (rules §5.6): `total` is its penalty. */
  miss?: boolean;
  /** Not played before 0:00, penalised as a miss. */
  unplayed?: boolean;
}

/** The live row's two lines (spec 047 amendment P1): a state, then an instruction or nothing. */
export interface LiveLines {
  line1: string;
  line2: string;
  /** Line 2 drawn in parts when it holds a crimson number or an action (spec 068); `line2` is its words. */
  line2Parts?: Line2Part[];
}

import type { Line2Part } from "./liveLine2";

export interface LedgerRow {
  /** The move number both columns share. */
  move: number;
  /** `settled`: the viewer's scored move held as the tinted row before the next opens (spec 050 FR-013). */
  status: "past" | "live" | "future" | "settled";
  you: SeatCell | null;
  opp: SeatCell | null;
  /** On a live or settled row: the viewer's column carries these lines instead of words. */
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
  /** Spec 071: the detail line's clauses; a phone shows the first two. */
  detailClauses?: string[];
}

export interface LedgerModel {
  caption: string;
  /** Whether the match is over. */
  completed?: boolean;
  /** The final totals, closing the table in the final state (2026-09-21). */
  totals?: { you: number; opp: number };
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
  | "resign"
  | "confirmResign"
  | "leave"
  | "rematch"
  | "acceptRematch"
  | "declineRematch"
  /** Spec 071: the sender's `cancel ▸`. */
  | "withdrawRematch"
  | "newOpponent"
  | "lobby"
  | "cancelQueue"
  | "toggleSound"
  | "signOut"
  | "profile"
  | "endEarly"
  | "keepWaiting"
  | "keepPlaying"
  /** Spec 070: the leave slip's safe action and its way out. */
  | "stay"
  | "goToLobby"
  | "reviewField"
  /** Spec 071: Esc lifts the result's slip without entering review. */
  | "liftSlip"
  | "result"
  | "howToPlay"
  | "findOpponent"
  /** Spec 069: the table. */
  | "sitDown"
  | "leaveTable"
  | "challengeAgain"
  /** Spec 070 B6: a call answered from the result screen's ledger line. */
  | "acceptCall"
  | "declineCall"
  | { challenge: string };

export type Notice =
  | { kind: "pickCleared"; byName: string; expiresAt: number }
  /** Spec 071 (T41): an incoming rematch once the slip is lifted or in review; accept ▸ and decline. */
  | { kind: "rematch"; text: string; drain: number }
  | { kind: "text"; text: string }
  /** Spec 070 B6: a third party's call on the result screen. */
  | { kind: "call"; inviteId: string; text: string };

export const EMPTY_TERRITORY: Territory = { you: 0, opp: 0, free: 100 };

export function emptyRows(total = 10): LedgerRow[] {
  return Array.from({ length: total }, (_, i) => ({
    move: i + 1,
    status: "future" as const,
    you: null,
    opp: null,
    folded: false,
  }));
}
