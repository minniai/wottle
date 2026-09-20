"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

import type { LedgerAction } from "@/lib/room/ledgerTypes";
import { useRoomStore } from "@/lib/room/roomStore";
import type { PlayerIdentity } from "@/lib/types/match";
import { useFieldSize } from "./hooks/useFieldSize";
import { Slip } from "./Slip";

/** Below this the design's 18% value numeral is unreadable (spec 045 decision 3). */
const CELL_SIZE_SMALL_PX = 32;

interface RoomProps {
  matchId?: string;
  topBar: ReactNode;
  field: ReactNode;
  bottomBar: ReactNode;
  ledger: ReactNode;
  /** Actions from the slip over the field (spec 048 §5.9); the store says whether one is up. */
  onSlipAction?: (action: LedgerAction) => void;
  onSignedIn?: (player: PlayerIdentity) => void;
}

const NO_ACTION = () => undefined;

/**
 * The room grid (design system §4): `bar / field / bar` stacked on the left,
 * the ledger on the right; one column below 900px. The field is the largest
 * square that fits, measured with a ResizeObserver, never viewport units.
 */
export function Room({ matchId, topBar, field, bottomBar, ledger, onSlipAction, onSignedIn }: RoomProps) {
  const phase = useRoomStore((s) => s.phase);
  const slip = useRoomStore((s) => (s.slipDismissed ? null : s.slip));
  const roomRef = useRef<HTMLDivElement | null>(null);
  const fieldSize = useFieldSize(roomRef);
  const style = fieldSize > 0 ? ({ "--field-size": `${fieldSize}px` } as CSSProperties) : undefined;

  return (
    <div ref={roomRef} className="room" data-testid="room" data-phase={phase} data-match-id={matchId} style={style}>
      <div className="room__stack">
        <div data-testid="room-slot-top">{topBar}</div>
        <div
          className="room__field-slot"
          data-testid="room-slot-field"
          data-cell-size={fieldSize > 0 && fieldSize / 10 < CELL_SIZE_SMALL_PX ? "small" : "regular"}
          data-slipped={slip ? "true" : undefined}
        >
          {field}
          {slip ? <Slip slip={slip} onAction={onSlipAction ?? NO_ACTION} onSignedIn={onSignedIn} /> : null}
        </div>
        <div data-testid="room-slot-bottom">{bottomBar}</div>
      </div>
      <aside className="room__ledger" data-testid="room-slot-ledger">
        {ledger}
      </aside>
    </div>
  );
}
