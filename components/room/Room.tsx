"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

import type { LedgerAction } from "@/lib/room/ledgerTypes";
import type { SlipState } from "@/lib/room/slip";
import { useRoomStore } from "@/lib/room/roomStore";
import type { PlayerIdentity } from "@/lib/types/match";
import { useFieldGeometry, type RoomLayout } from "./hooks/useFieldSize";
import { Slip } from "./Slip";

/** Below this the design's 18% value numeral is unreadable (spec 045 decision 3). */
const CELL_SIZE_SMALL_PX = 32;

interface RoomProps {
  matchId?: string;
  /** Two bars around the field (lobby, queue), or one scoreboard above it (the match states, spec 068). */
  layout?: RoomLayout;
  topBar: ReactNode;
  field: ReactNode;
  bottomBar: ReactNode;
  ledger: ReactNode;
  /** Actions from the slip over the field (spec 048 §5.9); the store says whether one is up. */
  onSlipAction?: (action: LedgerAction) => void;
  onSignedIn?: (player: PlayerIdentity) => void;
  /** A slip derived from the match rather than raised (spec 069: the table's); it stands unless a raised one is up. */
  slip?: SlipState | null;
}

const NO_ACTION = () => undefined;

/**
 * The measured sizes as custom properties. Under a scoreboard the cell is a
 * whole pixel count and is passed on as is, so the ledger's rows and the
 * board's rows share one integer (spec 068 FR-011–FR-013).
 */
function roomStyle(layout: RoomLayout, field: number, cell: number): CSSProperties | undefined {
  if (field <= 0) return undefined;
  const sizes: Record<string, string> = { "--field-size": `${field}px` };
  if (layout === "scoreboard") sizes["--room-cell"] = `${cell}px`;
  return sizes as CSSProperties;
}

/**
 * The room grid (design system §4): `bar / field / bar` stacked on the left,
 * the ledger on the right; one column below 900px. The field is the largest
 * square that fits, measured with a ResizeObserver, never viewport units.
 */
export function Room({ matchId, layout = "bars", topBar, field, bottomBar, ledger, onSlipAction, onSignedIn, slip: derived = null }: RoomProps) {
  const phase = useRoomStore((s) => s.phase);
  const raised = useRoomStore((s) => (s.slipDismissed ? null : s.slip));
  const slip = raised ?? derived;
  const roomRef = useRef<HTMLElement | null>(null);
  const { cell, field: fieldSize } = useFieldGeometry(roomRef, layout);
  const style = roomStyle(layout, fieldSize, cell);

  return (
    // The room is the page's main landmark (axe landmark-one-main); the ledger is its aside.
    <main ref={roomRef} className="room" data-testid="room" data-phase={phase} data-layout={layout} data-match-id={matchId} style={style}>
      <div className="room__stack">
        <div data-testid="room-slot-top">{topBar}</div>
        <div
          className="room__field-slot"
          data-testid="room-slot-field"
          data-cell-size={cell > 0 && cell < CELL_SIZE_SMALL_PX ? "small" : "regular"}
          data-slipped={slip ? "true" : undefined}
        >
          {field}
          {slip ? <Slip slip={slip} onAction={onSlipAction ?? NO_ACTION} onSignedIn={onSignedIn} /> : null}
        </div>
        {layout === "bars" || bottomBar ? <div data-testid="room-slot-bottom">{bottomBar}</div> : null}
      </div>
      <aside className="room__ledger" data-testid="room-slot-ledger">
        {ledger}
      </aside>
    </main>
  );
}
