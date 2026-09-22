"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { CSSProperties } from "react";

import type { Seat } from "@/lib/constants/seatColors";
import { getSeatColors } from "@/lib/constants/seatColors";

export type CellState = "free" | "picked" | "previewed" | "pinned" | "frozen" | "scored";

export interface FieldCellProps {
  x: number;
  y: number;
  letter: string;
  value: number;
  state: CellState;
  seat: Seat | null;
  ownerName?: string;
  shake?: boolean;
  /** Queue: this letter just landed (letter-land motion). */
  landing?: boolean;
  /** Frozen/pinned letters stay clickable so the reducer can shake them; aria-disabled marks them. */
  disabled?: boolean;
  tabIndex?: number;
  onActivate?: (x: number, y: number) => void;
  onPointerDown?: (x: number, y: number) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** FLIP offset: where this letter starts before travelling home (FR-027). */
  exchange?: { dx: number; dy: number } | null;
  onExchangeEnd?: (x: number, y: number) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, x: number, y: number) => void;
}

const COLUMN_LETTERS = "ABCDEFGHIJ";


export function FieldCell(props: FieldCellProps) {
  const copy = useCopy();
  const { x, y, letter, value, state, seat, ownerName, shake, landing, disabled, tabIndex = -1, onActivate, onPointerDown, onPointerUp, onKeyDown, exchange = null, onExchangeEnd } = props;
  const style = {
    ...(seat ? { "--seat-ink": getSeatColors(seat).ink } : {}),
    ...(exchange ? { "--dx": `${exchange.dx}px`, "--dy": `${exchange.dy}px` } : {}),
  } as CSSProperties;
  return (
    <button
      type="button"
      role="gridcell"
      className={`field__cell${shake ? " field__cell--shake" : ""}${landing ? " field__cell--landing" : ""}${exchange ? " field__cell--exchange" : ""}`}
      data-testid="field-cell"
      data-x={x}
      data-y={y}
      data-state={state}
      data-seat={seat ?? undefined}
      aria-label={copy.cellLabel({ row: y + 1, column: COLUMN_LETTERS[x], letter, value, state, ownerName })}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex}
      style={style}
      onClick={() => onActivate?.(x, y)}
      onPointerDown={() => onPointerDown?.(x, y)}
      onPointerUp={(event) => onPointerUp?.(event)}
      onKeyDown={(event) => onKeyDown?.(event, x, y)}
    >
      <span aria-hidden onAnimationEnd={() => exchange && onExchangeEnd?.(x, y)}>
        {letter}
      </span>
      <span className="field__value" aria-hidden>
        {letter ? value : ""}
      </span>
    </button>
  );
}
