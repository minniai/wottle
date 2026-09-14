"use client";

import type { CSSProperties } from "react";

import type { Seat } from "@/lib/constants/seatColors";
import { getSeatColors } from "@/lib/constants/seatColors";

export type CellState = "free" | "picked" | "previewed" | "pinned" | "frozen" | "scored" | "shared";

export interface FieldCellProps {
  x: number;
  y: number;
  letter: string;
  value: number;
  state: CellState;
  seat: Seat | null;
  ownerName?: string;
  shake?: boolean;
  disabled?: boolean;
  tabIndex?: number;
  onActivate?: (x: number, y: number) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, x: number, y: number) => void;
}

const COLUMN_LETTERS = "ABCDEFGHIJ";

/** `row 8, column F, T, value 2, free` — coordinates live only here (design system §9). */
export function cellLabel(x: number, y: number, letter: string, value: number, state: CellState, ownerName?: string): string {
  const stateWord = state === "frozen" && ownerName ? `frozen by ${ownerName}` : state;
  return `row ${y + 1}, column ${COLUMN_LETTERS[x]}, ${letter}, value ${value}, ${stateWord}`;
}

export function FieldCell(props: FieldCellProps) {
  const { x, y, letter, value, state, seat, ownerName, shake, disabled, tabIndex = -1, onActivate, onKeyDown } = props;
  const style = seat ? ({ "--seat-ink": getSeatColors(seat).ink } as CSSProperties) : undefined;
  return (
    <button
      type="button"
      role="gridcell"
      className={`field__cell${shake ? " field__cell--shake" : ""}`}
      data-testid="field-cell"
      data-x={x}
      data-y={y}
      data-state={state}
      data-seat={seat ?? undefined}
      aria-label={cellLabel(x, y, letter, value, state, ownerName)}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex}
      style={style}
      onClick={() => !disabled && onActivate?.(x, y)}
      onKeyDown={(event) => onKeyDown?.(event, x, y)}
    >
      <span aria-hidden>{letter}</span>
      <span className="field__value" aria-hidden>
        {value}
      </span>
    </button>
  );
}
