"use client";

import { useMemo, type ReactNode } from "react";

import { OPPONENT, YOU, reconnecting } from "@/lib/constants/copy";
import { formatClock } from "@/lib/room/clock";
import { buildMatchLedger, type AccumulatedWord, type LiveState } from "@/lib/room/ledgerRows";
import { barSuffixFor, barToneFor, type MoveState } from "@/lib/room/moveState";
import type { LedgerAction, Notice, Verdict } from "@/lib/room/ledgerTypes";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";
import { Ledger } from "./Ledger";
import { useIsPhone } from "./hooks/useIsPhone";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";
import { useCountUp } from "./hooks/useCountUp";
import { useReducedMotion } from "./hooks/useReducedMotion";

export interface SeatFacts {
  name: string;
  rating: number | null;
  /** Resolved moves (spec 050): the lane's length and the sub-line's count. */
  movesPlayed: number;
  /** This player has a move in flight. */
  scoring?: boolean;
  score: number;
  /** ms left in the reconnection window, when this player is disconnected. */
  reconnectMsLeft?: number | null;
  /** Final: `1191 → 1203 · +12 · wins` or `rating pending`. */
  finalLine?: string;
  /** The player's profile; opened in a new tab while the match is live. */
  profileHref?: string;
  profileInNewTab?: boolean;
}

export interface MatchRoomViewProps {
  matchId: string;
  viewerSlot: PlayerSlot | null;
  you: SeatFacts;
  opp: SeatFacts;
  /** The shared clock as the client reads it (spec 050); drawn once, in the ledger caption. */
  clockMs?: number;
  /** This match's clock length; the ledger clock's bar drains over it. */
  clockLengthMs?: number;
  /** The match ended on the clock with a player short of ten: their unplayed rows show penalties (rules §5.6). */
  penalizeUnplayed?: boolean;
  moveLimit?: number;
  completed: boolean;
  words: AccumulatedWord[];
  playerAId: string;
  frozenTiles: FrozenTileMap;
  live: LiveState;
  /** The viewer's beat (spec 050): line 1 of the live row, the bar suffixes, the field frame. */
  moveState?: MoveState;
  holdMove?: number | null;
  hiddenWordIds?: Set<string>;
  hint?: string;
  caption?: string;
  verdict?: Verdict;
  /** Non-participant viewing a completed match: no `· you`, no actions. */
  readOnly?: boolean;
  notices?: Notice[];
  footActions?: ReactNode;
  onRowHover?: (move: number | null) => void;
  onAction: (action: LedgerAction) => void;
  /** The field slot. */
  children: ReactNode;
}

function subline(facts: SeatFacts, seatWord: string | null): string {
  if (facts.finalLine) return facts.finalLine;
  if (facts.reconnectMsLeft != null) return reconnecting(formatClock(facts.reconnectMsLeft));
  return seatWord ? `${facts.rating ?? "unrated"} · ${seatWord}` : String(facts.rating ?? "unrated");
}

/** The match phase of the room: opponent bar / field / your bar + ledger (design system §7). */
export function MatchRoomView(props: MatchRoomViewProps) {
  const { matchId, viewerSlot, you, opp, clockMs, clockLengthMs, penalizeUnplayed = false, moveLimit = 10, completed, words, playerAId, frozenTiles, live } = props;
  const isPhone = useIsPhone();
  const { hiddenWordIds, hint, caption, verdict, readOnly = false, notices, footActions, onRowHover, onAction, children, moveState, holdMove = null } = props;
  const reducedMotion = useReducedMotion();
  const youScore = useCountUp(you.score, reducedMotion);
  const oppScore = useCountUp(opp.score, reducedMotion);
  const movesPlayed = useMemo(() => ({ you: you.movesPlayed, opp: opp.movesPlayed }), [you.movesPlayed, opp.movesPlayed]);

  const model = useMemo(() => {
    const base = buildMatchLedger({
      movesPlayed,
      moveLimit,
      completed,
      words,
      hiddenWordIds,
      playerAId,
      viewerSlot,
      live,
      frozenTiles,
      hint,
      moveState,
      holdMove,
      clockMs: completed ? undefined : clockMs,
      clockLengthMs,
      penalizeUnplayed,
    });
    return { ...base, caption: caption ?? base.caption, verdict };
  }, [movesPlayed, moveLimit, completed, words, hiddenWordIds, playerAId, viewerSlot, live, frozenTiles, hint, caption, verdict, moveState, holdMove, clockMs, clockLengthMs, penalizeUnplayed]);
  const turn = moveState && !completed && !readOnly ? moveState : null;
  const counts = { you: you.movesPlayed, opp: opp.movesPlayed, oppScoring: Boolean(opp.scoring), limit: moveLimit };
  const youSuffix = turn ? barSuffixFor(turn, "you", counts) : null;
  const oppSuffix = turn ? barSuffixFor(turn, "opp", counts) : null;

  return (
    <Room
      matchId={matchId}
      onSlipAction={onAction}
      topBar={
        <PlayerBar
          seat="opp"
          position="top"
          state={completed ? "final" : "playing"}
          name={opp.name}
          profileHref={opp.profileHref}
          profileInNewTab={opp.profileInNewTab}
          subline={subline(opp, readOnly ? null : OPPONENT)}
          sublineSuffix={opp.reconnectMsLeft != null ? null : oppSuffix}
          movesPlayed={opp.movesPlayed}
          moveInFlight={opp.scoring}
          moveLimit={moveLimit}
          score={oppScore}
          disconnected={opp.reconnectMsLeft != null}
        />
      }
      field={children}
      bottomBar={
        <PlayerBar
          seat="you"
          position="bottom"
          state={completed ? "final" : "playing"}
          name={you.name}
          profileHref={you.profileHref}
          profileInNewTab={you.profileInNewTab}
          subline={subline(you, readOnly ? null : YOU)}
          sublineSuffix={youSuffix}
          sublineTone={turn ? barToneFor(turn) : "muted"}
          movesPlayed={you.movesPlayed}
          moveInFlight={you.scoring}
          moveLimit={moveLimit}
          score={youScore}
          disconnected={you.reconnectMsLeft != null}
        />
      }
      ledger={
        <Ledger
          variant={completed ? "final" : "match"}
          collapsed={isPhone}
          model={model}
          notices={notices}
          viewerName={you.name}
          opponentName={opp.name}
          readOnly={readOnly}
          footActions={footActions}
          onRowHover={onRowHover}
          onAction={onAction}
        />
      }
    />
  );
}
