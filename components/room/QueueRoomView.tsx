"use client";

import { useMemo, type ReactNode } from "react";

import { CANCEL, FINDING_OPPONENT, OPPONENT, QUEUE_CONTEXT, roundOneIn, searchingSubline, YOU } from "@/lib/constants/copy";
import type { LedgerAction, LedgerModel } from "@/lib/room/ledgerTypes";
import { EMPTY_TERRITORY, emptyRows } from "@/lib/room/ledgerTypes";
import type { PlayerIdentity } from "@/lib/types/match";
import { Ledger } from "./Ledger";
import { useIsPhone } from "./hooks/useIsPhone";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";

export interface QueueRoomViewProps {
  viewer: PlayerIdentity;
  /** Set once an opponent is found; `null` while searching. */
  opponent: PlayerIdentity | null;
  /** Set once found: the round-1 countdown, 3 → 2 → 1. */
  found: { countdown: 3 | 2 | 1 } | null;
  /** Time in the queue, already formatted (`0:07`). */
  elapsed: string;
  /** The live line: `setting the field · n of 100 letters`, then `round 1 in 3`. */
  live: string;
  hint: string;
  onAction: (action: LedgerAction) => void;
  /** The field slot — the placeholder field, wired by the controller. */
  children: ReactNode;
}

const FULL_CLOCK_MS = 300_000;

/**
 * The queue and found phases of the room (spec 044 US8): a placeholder field
 * sets itself letter by letter; when an opponent is found their name writes into
 * the top bar and round 1 counts down.
 *
 * Presentational, as `MatchRoomView` is: polling, timers and the board swap stay
 * in the controller so the fixture route can mount this without a database
 * (spec 045 FR-003).
 */
export function QueueRoomView(props: QueueRoomViewProps) {
  const { viewer, opponent, found, elapsed, live, hint, onAction, children } = props;
  const isPhone = useIsPhone();

  const model: LedgerModel = useMemo(
    () => ({ caption: QUEUE_CONTEXT, rows: emptyRows(), territory: EMPTY_TERRITORY, hint, live }),
    [hint, live],
  );

  const cancelButton = (testId: string, className: string) => (
    <button type="button" className={className} data-testid={testId} onClick={() => onAction("cancelQueue")}>
      {CANCEL}
    </button>
  );

  return (
    <Room
      topBar={
        found ? (
          <PlayerBar
            seat="opp"
            position="top"
            state="found"
            name={opponent?.displayName ?? "opponent"}
            subline={`${opponent?.eloRating ?? "unrated"} · ${OPPONENT} · ${roundOneIn(found.countdown)}`}
            clockMs={FULL_CLOCK_MS}
            clockRunning={false}
            score={0}
          />
        ) : (
          <PlayerBar
            seat="opp"
            position="top"
            state="searching"
            name={FINDING_OPPONENT}
            subline={searchingSubline(elapsed)}
            action={cancelButton("player-bar-action-cancel", "action-secondary")}
          />
        )
      }
      field={children}
      bottomBar={
        <PlayerBar seat="you" position="bottom" state="idle" name={viewer.displayName} subline={`${viewer.eloRating ?? "unrated"} · ${YOU}`} />
      }
      ledger={
        <Ledger
          variant="queue"
          collapsed={isPhone}
          model={model}
          viewerName={viewer.displayName}
          opponentName={opponent?.displayName ?? null}
          footActions={found ? null : cancelButton("ledger-cancel-queue", "action-secondary")}
          onAction={onAction}
        />
      }
    />
  );
}
