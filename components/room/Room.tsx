"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

import { useRoomStore } from "@/lib/room/roomStore";
import { useFieldSize } from "./hooks/useFieldSize";

interface RoomProps {
  topBar: ReactNode;
  field: ReactNode;
  bottomBar: ReactNode;
  ledger: ReactNode;
}

/**
 * The room grid (design system §4): `bar / field / bar` stacked on the left,
 * the ledger on the right; one column below 900px. The field is the largest
 * square that fits, measured with a ResizeObserver, never viewport units.
 */
export function Room({ topBar, field, bottomBar, ledger }: RoomProps) {
  const phase = useRoomStore((s) => s.phase);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const fieldSize = useFieldSize(roomRef);
  const style = fieldSize > 0 ? ({ "--field-size": `${fieldSize}px` } as CSSProperties) : undefined;

  return (
    <div ref={roomRef} className="room" data-testid="room" data-phase={phase} style={style}>
      <div className="room__stack">
        <div data-testid="room-slot-top">{topBar}</div>
        <div className="room__field-slot" data-testid="room-slot-field">
          {field}
        </div>
        <div data-testid="room-slot-bottom">{bottomBar}</div>
      </div>
      <aside className="room__ledger" data-testid="room-slot-ledger">
        {ledger}
      </aside>
    </div>
  );
}
