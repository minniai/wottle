"use client";

import { useEffect, useRef } from "react";

import { ratingLine, type RatingRow } from "@/lib/room/ledgerRows";
import type { Verdict } from "@/lib/room/ledgerTypes";
import { MATCH_OVER_DELAY_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";
import type { EndReason, SlipRatingRow, SlipState } from "@/lib/room/slip";
import type { RematchView } from "@/lib/room/rematchView";
import { useCopy } from "@/components/i18n/LocaleProvider";
import type { Copy } from "@/lib/i18n/copy/types";
import type { MatchState, PlayerSlot } from "@/lib/types/match";

export interface MatchOverSlipInput {
  match: MatchState;
  viewerSlot: PlayerSlot;
  completed: boolean;
  readOnly: boolean;
  verdict: Verdict | null;
  durationMmSs: string;
  viewerName: string;
  opponentName: string;
  ratings: RatingRow[] | null;
  rematch: RematchView | null;
  /** A reveal or the move hold is still running; the slip waits for it. */
  busy: boolean;
  /** A reveal ran in this session, so the slip lands after the delay rather than at once. */
  revealed: boolean;
  /** Spec 071: the viewer's highest-scoring word, or null. */
  bestWord?: { word: string; points: number } | null;
}

/**
 * The server records why the match ended; guessing from the state that is left
 * read `· resigned` for a player who had merely disconnected (seen live,
 * 2026-09-20). Only fall back to a guess for a row written before the reason was.
 */
const REASONS: Record<string, EndReason> = {
  moves_complete: "moves",
  incomplete: "incomplete",
  both_incomplete: "incomplete",
  disconnect: "abandoned",
  abandoned: "abandoned",
  forfeit: "resigned",
  error: "moves",
};

export function endReasonFor(match: MatchState): EndReason {
  const recorded = match.endedReason ? REASONS[match.endedReason] : undefined;
  if (recorded) return recorded;
  if (match.state === "abandoned" || match.disconnectedPlayerId) return "abandoned";
  const bothDone = match.players.playerA.movesPlayed >= match.moveLimit && match.players.playerB.movesPlayed >= match.moveLimit;
  return bothDone ? "moves" : "incomplete";
}

function ratingRows(input: MatchOverSlipInput, copy: Copy): SlipRatingRow[] {
  const { match, viewerSlot, ratings, verdict, viewerName, opponentName } = input;
  const youId = match.players[viewerSlot === "player_a" ? "playerA" : "playerB"].playerId;
  const oppId = match.players[viewerSlot === "player_a" ? "playerB" : "playerA"].playerId;
  const first: SlipRatingRow = { seat: verdict?.winnerSeat === "you" ? "you" : "opp", name: "", line: "" };
  const rows: SlipRatingRow[] = [
    { seat: "you", name: `${viewerName} · ${copy.YOU}`, line: ratingLine(ratings, youId, verdict?.winnerSeat === "you", copy) },
    { seat: "opp", name: opponentName, line: ratingLine(ratings, oppId, verdict?.winnerSeat === "opp", copy) },
  ];
  // The winner's row first, as on the bars.
  return rows.sort((a) => (a.seat === first.seat ? -1 : 1));
}

export function buildMatchOverSlip(input: MatchOverSlipInput, copy: Copy): SlipState | null {
  const { match, viewerSlot, verdict, durationMmSs, viewerName, opponentName, rematch, readOnly } = input;
  if (!verdict) return null;
  const you = match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = match.scores[viewerSlot === "player_a" ? "playerB" : "playerA"];
  return {
    kind: "matchOver",
    verdict,
    durationMmSs,
    scores: { you, opp },
    viewerName,
    opponentName,
    ratings: ratingRows(input, copy),
    rematch,
    readOnly,
    bestWord: input.bestWord ?? null,
  };
}

/**
 * The match-over slip (spec 048 FR-003): lands `MATCH_OVER_DELAY_MS` after the
 * final reveal has settled and held; at once on a reload with nothing to reveal.
 * Later rating rows and rematch phases rewrite the same slip in place.
 */
export function useMatchOverSlip(input: MatchOverSlipInput): void {
  const setSlip = useRoomStore((s) => s.setSlip);
  const landed = useRef(false);
  const matchId = input.match.matchId;
  useEffect(() => {
    landed.current = false;
  }, [matchId]);
  const { completed, busy, revealed } = input;
  const copy = useCopy();
  const slip = buildMatchOverSlip(input, copy);
  const key = slip ? JSON.stringify(slip) : null;

  useEffect(() => {
    // Spec 071 (FR-042): a reader of a finished match gets no result slip; review is theirs.
    if (!completed || busy || !key || input.readOnly) return;
    const next = JSON.parse(key) as SlipState;
    if (landed.current) {
      setSlip(next);
      return;
    }
    const timer = setTimeout(() => {
      landed.current = true;
      setSlip(next);
    }, revealed ? MATCH_OVER_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [matchId, completed, busy, key, revealed, setSlip, input.readOnly]);
}
