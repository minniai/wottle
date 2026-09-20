"use client";

import { useEffect, useRef } from "react";

import { ratingLine, type RatingRow } from "@/lib/room/ledgerRows";
import type { Verdict } from "@/lib/room/ledgerTypes";
import { MATCH_OVER_DELAY_MS } from "@/lib/room/revealSequence";
import { useRoomStore } from "@/lib/room/roomStore";
import type { EndReason, SlipRatingRow, SlipState } from "@/lib/room/slip";
import type { RematchPhase } from "@/lib/room/useRematchNegotiation";
import { YOU } from "@/lib/constants/copy";
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
  rematch: RematchPhase;
  /** A reveal or the settle hold is still running; the slip waits for it. */
  busy: boolean;
  /** A reveal ran in this session, so the slip lands after the delay rather than at once. */
  revealed: boolean;
}

/** `MatchState` carries no end reason; read it off the state that is there. */
export function endReasonFor(match: MatchState): EndReason {
  if (match.state === "abandoned" || match.disconnectedPlayerId) return "abandoned";
  const spent = match.timers.playerA.remainingMs <= 0 || match.timers.playerB.remainingMs <= 0;
  if (spent) return "timeout";
  return match.currentRound < 10 ? "resigned" : "rounds";
}

function ratingRows(input: MatchOverSlipInput): SlipRatingRow[] {
  const { match, viewerSlot, ratings, verdict, viewerName, opponentName } = input;
  const youId = match.timers[viewerSlot === "player_a" ? "playerA" : "playerB"].playerId;
  const oppId = match.timers[viewerSlot === "player_a" ? "playerB" : "playerA"].playerId;
  const first: SlipRatingRow = { seat: verdict?.winnerSeat === "you" ? "you" : "opp", name: "", line: "" };
  const rows: SlipRatingRow[] = [
    { seat: "you", name: `${viewerName} · ${YOU}`, line: ratingLine(ratings, youId, verdict?.winnerSeat === "you") },
    { seat: "opp", name: opponentName, line: ratingLine(ratings, oppId, verdict?.winnerSeat === "opp") },
  ];
  // The winner's row first, as on the bars.
  return rows.sort((a) => (a.seat === first.seat ? -1 : 1));
}

export function buildMatchOverSlip(input: MatchOverSlipInput): SlipState | null {
  const { match, viewerSlot, verdict, durationMmSs, viewerName, opponentName, rematch, readOnly } = input;
  if (!verdict) return null;
  const you = match.scores[viewerSlot === "player_a" ? "playerA" : "playerB"];
  const opp = match.scores[viewerSlot === "player_a" ? "playerB" : "playerA"];
  return {
    kind: "matchOver",
    verdict,
    reason: endReasonFor(match),
    rounds: Math.min(match.currentRound, 10),
    durationMmSs,
    scores: { you, opp },
    viewerName,
    opponentName,
    ratings: ratingRows(input),
    rematch,
    readOnly,
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
  const slip = buildMatchOverSlip(input);
  const key = slip ? JSON.stringify(slip) : null;

  useEffect(() => {
    if (!completed || busy || !key) return;
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
  }, [matchId, completed, busy, key, revealed, setSlip]);
}
