"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";
import { FieldCell, type CellState } from "./FieldCell";

export interface FieldProps {
  board: string[][];
  frozenTiles?: FrozenTileMap;
  viewerSlot: PlayerSlot | null;
  /** Names by slot for the frozen-cell label (`frozen by Kári`). */
  ownerNames?: Partial<Record<PlayerSlot, string>>;
  /** Cells shared by both seats' words render in ink at weight 700. */
  sharedCells?: Set<string>;
  disabled?: boolean;
  /** Overlay layer (word bands) rendered under the cells. */
  bands?: ReactNode;
  cellStateFor?: (coord: Coordinate, base: CellState) => CellState;
  seatFor?: (coord: Coordinate) => Seat | null;
  shakeAt?: Coordinate | null;
  focusAt?: Coordinate | null;
  onActivate?: (coord: Coordinate) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, coord: Coordinate) => void;
}

const VALUES = LETTER_SCORING_VALUES_IS as Record<string, number>;

function letterValue(letter: string): number {
  return VALUES[letter.toUpperCase()] ?? VALUES[letter] ?? 0;
}

/**
 * The field (design system §5.1): a hundred capitals on paper, 1px rules,
 * 1.5px ink frame, value numeral in the top-right gutter. Static in P1; the
 * pick/preview/commit reducer drives it from P3 through `cellStateFor`.
 */
export function Field(props: FieldProps) {
  const { board, frozenTiles = {}, viewerSlot, ownerNames = {}, sharedCells, disabled, bands } = props;
  const { cellStateFor, seatFor, shakeAt, focusAt, onActivate, onKeyDown } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    performance.mark?.("field:hydrated");
  }, []);

  useEffect(() => {
    if (!focusAt) return;
    ref.current
      ?.querySelector<HTMLButtonElement>(`[data-x="${focusAt.x}"][data-y="${focusAt.y}"]`)
      ?.focus();
  }, [focusAt]);

  return (
    <div ref={ref} className="field" role="grid" aria-label="the field" data-testid="field" data-disabled={disabled || undefined}>
      {bands}
      {board.map((row, y) =>
        row.map((letter, x) => {
          const key = `${x},${y}`;
          const frozen = frozenTiles[key];
          const base: CellState = sharedCells?.has(key) ? "shared" : frozen ? "frozen" : "free";
          const state = cellStateFor ? cellStateFor({ x, y }, base) : base;
          const seat = seatFor?.({ x, y }) ?? (frozen ? seatForSlot(viewerSlot, frozen.owner) : null);
          return (
            <FieldCell
              key={key}
              x={x}
              y={y}
              letter={letter}
              value={letterValue(letter)}
              state={state}
              seat={state === "shared" ? null : seat}
              ownerName={frozen ? ownerNames[frozen.owner] : undefined}
              shake={shakeAt?.x === x && shakeAt?.y === y}
              disabled={disabled || Boolean(frozen)}
              tabIndex={x === 0 && y === 0 ? 0 : -1}
              onActivate={(cx, cy) => onActivate?.({ x: cx, y: cy })}
              onKeyDown={(event, cx, cy) => onKeyDown?.(event, { x: cx, y: cy })}
            />
          );
        }),
      )}
    </div>
  );
}
