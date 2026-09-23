"use client";

import { useMemo, type ReactNode } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { LedgerAction, LedgerModel } from "@/lib/room/ledgerTypes";
import { EMPTY_TERRITORY, emptyRows } from "@/lib/room/ledgerTypes";
import type { PlayerIdentity } from "@/lib/types/match";
import { Ledger } from "./Ledger";
import { useIsPhone } from "./hooks/useIsPhone";
import { PlayerBar } from "./PlayerBar";
import { Room } from "./Room";

export interface QueueRoomViewProps {
  viewer: PlayerIdentity;
  /** Always `null` since the table took the found moment (spec 069); kept for the ledger's header. */
  opponent: PlayerIdentity | null;
  /** Time in the queue, already formatted (`0:07`). */
  elapsed: string;
  /** The live line: `setting the field · n of 100 letters`, then `round 1 in 3`. */
  live: string;
  /**
   * Spec 069: what the search says when it is not simply searching (paused, the
   * 3:00 check, stopped, the cooldown): the top bar's name and sub-line, and its action.
   */
  search?: { name: string; subline: string; action?: ReactNode } | null;
  hint: string;
  onAction: (action: LedgerAction) => void;
  /** The field slot — the placeholder field, wired by the controller. */
  children: ReactNode;
}


/**
 * The queue phase of the room (spec 044 US8): a placeholder field sets itself
 * letter by letter while the search runs. A pairing goes to the table
 * (spec 069), which is the match's own page.
 *
 * Presentational, as `MatchRoomView` is: polling, timers and the board swap stay
 * in the controller so the fixture route can mount this without a database
 * (spec 045 FR-003).
 */
export function QueueRoomView(props: QueueRoomViewProps) {
  const { CANCEL, FINDING_OPPONENT, QUEUE_CONTEXT, searchingSubline, YOU, UNRATED } = useCopy();
  const { viewer, opponent, elapsed, live, hint, onAction, children } = props;
  const isPhone = useIsPhone();

  const model: LedgerModel = useMemo(
    () => ({ caption: QUEUE_CONTEXT, rows: emptyRows(), territory: EMPTY_TERRITORY, hint, live }),
    [hint, live, QUEUE_CONTEXT],
  );

  const cancelButton = (testId: string, className: string) => (
    <button type="button" className={className} data-testid={testId} onClick={() => onAction("cancelQueue")}>
      {CANCEL}
    </button>
  );

  return (
    <Room
      topBar={
        <PlayerBar
          seat="opp"
          position="top"
          state="searching"
          name={props.search?.name ?? FINDING_OPPONENT}
          subline={props.search?.subline ?? searchingSubline(elapsed)}
          action={props.search ? props.search.action : cancelButton("player-bar-action-cancel", "action-secondary")}
        />
      }
      field={children}
      bottomBar={
        <PlayerBar seat="you" position="bottom" state="idle" name={viewer.displayName} subline={`${viewer.eloRating ?? UNRATED} · ${YOU}`} />
      }
      ledger={
        <Ledger
          variant="queue"
          collapsed={isPhone}
          model={model}
          viewerName={viewer.displayName}
          opponentName={opponent?.displayName ?? null}
          footActions={cancelButton("ledger-cancel-queue", "action-secondary")}
          onAction={onAction}
        />
      }
    />
  );
}
