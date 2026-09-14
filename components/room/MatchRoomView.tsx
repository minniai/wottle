"use client";

import { useMemo, type ReactNode } from "react";

import { OPPONENT, YOU, reconnecting } from "@/lib/constants/copy";
import { formatClock } from "@/lib/room/clock";
import { buildMatchLedger, type AccumulatedWord, type LiveState } from "@/lib/room/ledgerRows";
import type { LedgerAction, Notice } from "@/lib/room/ledgerTypes";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";
import { Ledger } from "./Ledger";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";

export interface SeatFacts {
  name: string;
  rating: number | null;
  clockMs: number;
  running: boolean;
  score: number;
  /** ms left in the reconnection window, when this player is disconnected. */
  reconnectMsLeft?: number | null;
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
  hint?: string;
  notices?: Notice[];
  footActions?: ReactNode;
  onRowHover?: (round: number | null) => void;
  onAction: (action: LedgerAction) => void;
  /** The field slot — BoardGrid until the Field takes over in US2. */
  children: ReactNode;
}

function subline(facts: SeatFacts, seatWord: string): string {
  if (facts.reconnectMsLeft != null) return reconnecting(formatClock(facts.reconnectMsLeft));
  return `${facts.rating ?? "unrated"} · ${seatWord}`;
}

/** The match phase of the room: opponent bar / field / your bar + ledger (design system §7). */
export function MatchRoomView(props: MatchRoomViewProps) {
  const { matchId, viewerSlot, you, opp, currentRound, completed, words, playerAId, frozenTiles, live } = props;
  const { hint, notices, footActions, onRowHover, onAction, children } = props;

  const model = useMemo(
    () => buildMatchLedger({ currentRound, completed, words, playerAId, viewerSlot, live, frozenTiles, hint }),
    [currentRound, completed, words, playerAId, viewerSlot, live, frozenTiles, hint],
  );

  return (
    <Room
      matchId={matchId}
      topBar={
        <PlayerBar
          seat="opp"
          position="top"
          state={completed ? "final" : "playing"}
          name={opp.name}
          subline={subline(opp, OPPONENT)}
          clockMs={opp.clockMs}
          clockRunning={opp.running}
          score={opp.score}
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
          subline={subline(you, YOU)}
          clockMs={you.clockMs}
          clockRunning={you.running}
          score={you.score}
          disconnected={you.reconnectMsLeft != null}
        />
      }
      ledger={
        <Ledger
          variant={completed ? "final" : "match"}
          model={model}
          notices={notices}
          viewerName={you.name}
          opponentName={opp.name}
          footActions={footActions}
          onRowHover={onRowHover}
          onAction={onAction}
        />
      }
    />
  );
}
