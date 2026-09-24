"use client";

import { useMemo, type ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { Copy } from "@/lib/i18n/copy/types";
import { buildMatchLedger, type AccumulatedWord, type LiveState } from "@/lib/room/ledgerRows";
import type { Line2Extras, MoveState } from "@/lib/room/moveState";
import { deriveScoreboard, type ScoreboardPhase, type ScoreboardReview, type ScoreboardTable } from "@/lib/room/scoreboard";
import type { SlipState } from "@/lib/room/slip";
import type { LedgerAction, Notice, Verdict } from "@/lib/room/ledgerTypes";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";
import { Ledger, type LedgerReview } from "./Ledger";
import { useIsPhone } from "./hooks/useIsPhone";
import { Room } from "./Room";
import { Scoreboard } from "./Scoreboard";
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
  /** The window is spent and this player is still away: for how long (spec 068). */
  goneForMs?: number | null;
  /** Spec 070 US8: this player's app is open on another page. */
  steppedOut?: boolean;
  /** The viewer's own transport has lost the match (spec 068). */
  offline?: boolean;
  /** Final: `1191 → 1203 · +12 · wins` or `rating pending`. */
  finalLine?: string;
  /** The player's profile; opened in a new tab while the match is live. */
  profileHref?: string;
  profileInNewTab?: boolean;
}

export interface MatchRoomReview {
  scoreboard: ScoreboardReview;
  ledger: LedgerReview;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
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
  /** Before `started_at`: ms until the clock starts (the 3·2·1). */
  msToStart?: number;
  /** Match over: how long it ran. */
  elapsedMs?: number;
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
  /** What else claims the live row's second line (spec 068 FR-031). */
  line2Extras?: Line2Extras;
  /** The room's polite region: the opponent's moves and the clock marks (spec 068 FR-033, FR-010). */
  announcement?: string;
  holdMove?: number | null;
  hiddenWordIds?: Set<string>;
  hint?: string;
  caption?: string;
  verdict?: Verdict;
  /** Non-participant viewing a completed match: no `· you`, no actions. */
  readOnly?: boolean;
  /** Spec 069: who has sat down, and why a void was void. */
  table?: ScoreboardTable;
  /** Spec 071: `match 2 · Birna 1–0` for a rematch. */
  series?: string | null;
  /** Spec 071 (US3): review at a step; the seats carry the totals and moves at it. */
  review?: MatchRoomReview;
  /** Spec 069: the table's slip, derived from the match (ready or void). */
  tableSlip?: SlipState | null;
  notices?: Notice[];
  footActions?: ReactNode;
  onRowHover?: (move: number | null) => void;
  onAction: (action: LedgerAction) => void;
  /** The field slot. */
  children: ReactNode;
}

function scoreboardPhase(completed: boolean, moveState: MoveState | undefined): ScoreboardPhase {
  if (moveState?.kind === "table" || moveState?.kind === "void") return moveState.kind;
  if (completed) return "over";
  return moveState?.kind === "starting" ? "starting" : "live";
}

/** The match phase of the room: the scoreboard over the field, and the ledger (spec 068, design system §7). */
export function MatchRoomView(props: MatchRoomViewProps) {
  const copy = useCopy();
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
      line2Extras: props.line2Extras,
      holdMove,
      penalizeUnplayed,
    }, copy);
    const totals = completed ? { you: you.score, opp: opp.score } : undefined;
    // Game flow F5: on a phone the table's facts line leaves the slip for the live row's place.
    const readySlip = props.tableSlip?.kind === "ready" ? props.tableSlip : null;
    const phoneFacts = isPhone && readySlip ? { live: readySlip.model.facts } : {};
    return { ...base, caption: caption ?? base.caption, verdict, totals, ...phoneFacts };
  }, [you.score, opp.score, movesPlayed, moveLimit, completed, words, hiddenWordIds, playerAId, viewerSlot, live, frozenTiles, hint, caption, verdict, moveState, props.line2Extras, holdMove, penalizeUnplayed, copy, isPhone, props.tableSlip]);
  const scoreboard = useMemo(
    () =>
      deriveScoreboard(
        {
          phase: scoreboardPhase(completed, moveState),
          moveState: completed || readOnly ? null : (moveState ?? null),
          remainingMs: clockMs ?? 0,
          clockLengthMs: clockLengthMs ?? 300_000,
          msToStart: props.msToStart,
          elapsedMs: props.elapsedMs,
          moveLimit,
          readOnly,
          compact: isPhone,
          you: { name: you.name, rating: you.rating, movesPlayed: you.movesPlayed, inFlight: Boolean(you.scoring), score: you.score, offline: you.offline, finalLine: you.finalLine },
          opp: { name: opp.name, rating: opp.rating, movesPlayed: opp.movesPlayed, inFlight: Boolean(opp.scoring), score: opp.score, reconnectMsLeft: opp.reconnectMsLeft, goneForMs: opp.goneForMs, steppedOut: opp.steppedOut, finalLine: opp.finalLine },
          table: props.table,
          series: props.series,
          review: props.review?.scoreboard,
        },
        copy,
      ),
    [completed, moveState, readOnly, clockMs, clockLengthMs, props.msToStart, props.elapsedMs, moveLimit, isPhone, you, opp, props.table, props.series, props.review?.scoreboard, copy],
  );

  return (
    <Room
      matchId={matchId}
      onSlipAction={onAction}
      slip={props.tableSlip ?? null}
      layout="scoreboard"
      topBar={
        <Scoreboard
          view={scoreboard}
          totals={{ you: youScore, opp: oppScore }}
          profiles={{ you: you.profileHref, opp: opp.profileHref }}
          profileInNewTab={Boolean(opp.profileInNewTab)}
          compact={isPhone}
          onReviewStep={props.review?.onStep}
          onReviewTogglePlay={props.review?.onTogglePlay}
        />
      }
      field={
        <>
          {children}
          <div className="sr-only" aria-live="polite" data-testid="room-announcer">
            {props.announcement ?? ""}
          </div>
        </>
      }
      bottomBar={null}
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
          review={props.review?.ledger}
        />
      }
    />
  );
}
