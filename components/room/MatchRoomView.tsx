"use client";

import { useMemo, type ReactNode } from "react";

import { OPPONENT, YOU, reconnecting } from "@/lib/constants/copy";
import { formatClock } from "@/lib/room/clock";
import { buildMatchLedger, type AccumulatedWord, type LiveState } from "@/lib/room/ledgerRows";
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
  clockMs: number;
  running: boolean;
  score: number;
  /** ms left in the reconnection window, when this player is disconnected. */
  reconnectMsLeft?: number | null;
  /** Final: `1191 → 1203 · +12 · wins` or `rating pending`. */
  finalLine?: string;
}

export interface MatchRoomViewProps {
  matchId: string;
  viewerSlot: PlayerSlot | null;
  you: SeatFacts;
  opp: SeatFacts;
  currentRound: number;
  completed: boolean;
  words: AccumulatedWord[];
  playerAId: string;
  frozenTiles: FrozenTileMap;
  live: LiveState;
  hiddenWordIds?: Set<string>;
  hint?: string;
  caption?: string;
  verdict?: Verdict;
  /** Non-participant viewing a completed match: no `· you`, no actions. */
  readOnly?: boolean;
  notices?: Notice[];
  footActions?: ReactNode;
  onRowHover?: (round: number | null) => void;
  onAction: (action: LedgerAction) => void;
  /** The field slot — BoardGrid until the Field takes over in US2. */
  children: ReactNode;
}

function subline(facts: SeatFacts, seatWord: string | null): string {
  if (facts.finalLine) return facts.finalLine;
  if (facts.reconnectMsLeft != null) return reconnecting(formatClock(facts.reconnectMsLeft));
  return seatWord ? `${facts.rating ?? "unrated"} · ${seatWord}` : String(facts.rating ?? "unrated");
}

/** The match phase of the room: opponent bar / field / your bar + ledger (design system §7). */
export function MatchRoomView(props: MatchRoomViewProps) {
  const { matchId, viewerSlot, you, opp, currentRound, completed, words, playerAId, frozenTiles, live } = props;
  const isPhone = useIsPhone();
  const { hiddenWordIds, hint, caption, verdict, readOnly = false, notices, footActions, onRowHover, onAction, children } = props;
  const reducedMotion = useReducedMotion();
  const youScore = useCountUp(you.score, reducedMotion);
  const oppScore = useCountUp(opp.score, reducedMotion);

  const model = useMemo(() => {
    const base = buildMatchLedger({ currentRound, completed, words, hiddenWordIds, playerAId, viewerSlot, live, frozenTiles, hint });
    return { ...base, caption: caption ?? base.caption, verdict };
  }, [currentRound, completed, words, hiddenWordIds, playerAId, viewerSlot, live, frozenTiles, hint, caption, verdict]);

  return (
    <Room
      matchId={matchId}
      topBar={
        <PlayerBar
          seat="opp"
          position="top"
          state={completed ? "final" : "playing"}
          name={opp.name}
          subline={subline(opp, readOnly ? null : OPPONENT)}
          clockMs={opp.clockMs}
          clockRunning={opp.running}
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
          subline={subline(you, readOnly ? null : YOU)}
          clockMs={you.clockMs}
          clockRunning={you.running}
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
