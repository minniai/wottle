"use client";

import { useEffect, useMemo, useRef } from "react";

import { LETTER_SCORING_VALUES_IS } from "@/lib/game-engine/letter-values/letter_scoring_values_is";
import { seatForSlot, type Seat } from "@/lib/constants/seatColors";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";
import {
  seatOfCell,
  sharedCells as sharedFromBands,
  type WordBand,
} from "@/lib/room/bandGeometry";
import { FieldBands } from "./FieldBands";
import { FieldCell, type CellState } from "./FieldCell";

export interface FieldProps {
  board: string[][];
  frozenTiles?: FrozenTileMap;
  viewerSlot: PlayerSlot | null;
  /** Names by slot for the frozen-cell label (`frozen by Kári`). */
  ownerNames?: Partial<Record<PlayerSlot, string>>;
  /** Extra cells to render in ink (both seats); normally derived from `bands`. */
  sharedCells?: Set<string>;
  disabled?: boolean;
  /** Scored words drawn as bands under the cells (design system §5.2). */
  bands?: WordBand[];
  highlightRound?: number | null;
  drawnCount?: number | null;
  drawingIndex?: number | null;
  /** Queue: only the first `landedCount` letters (reading order) are shown; null = all. */
  landedCount?: number | null;
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
  const {
    board,
    frozenTiles = {},
    viewerSlot,
    ownerNames = {},
    disabled,
    bands = [],
    highlightRound = null,
    drawnCount = null,
    drawingIndex = null,
    landedCount = null,
  } = props;
  const shared = useMemo(
    () => new Set([...(props.sharedCells ?? []), ...sharedFromBands(bands)]),
    [props.sharedCells, bands],
  );
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
    <div
      ref={ref}
      className="field"
      role="grid"
      aria-label="the field"
      data-testid="field"
      data-disabled={disabled || undefined}
    >
      <FieldBands
        bands={bands}
        highlightRound={highlightRound}
        drawnCount={drawnCount}
        drawingIndex={drawingIndex}
      />
      {/* role=row wrappers keep the grid → row → gridcell tree axe requires; display: contents leaves the CSS grid intact. */}
      {board.map((row, y) => (
        <div role="row" className="field__row" key={y}>
          {row.map((letter, x) => {
            const key = `${x},${y}`;
            const index = y * 10 + x;
            const landed = landedCount === null || index < landedCount;
            const frozen = frozenTiles[key];
            const bandSeat = seatOfCell(bands, { x, y });
            const base: CellState = shared.has(key)
              ? "shared"
              : bandSeat
                ? "scored"
                : frozen
                  ? "frozen"
                  : "free";
            const state = cellStateFor ? cellStateFor({ x, y }, base) : base;
            const seat =
              seatFor?.({ x, y }) ??
              bandSeat ??
              (frozen ? seatForSlot(viewerSlot, frozen.owner) : null);
            return (
              <FieldCell
                key={key}
                x={x}
                y={y}
                letter={landed ? letter : ""}
                value={landed ? letterValue(letter) : 0}
                landing={landedCount !== null && index === landedCount - 1}
                state={state}
                seat={state === "shared" ? null : seat}
                ownerName={frozen ? ownerNames[frozen.owner] : undefined}
                shake={shakeAt?.x === x && shakeAt?.y === y}
                disabled={disabled || Boolean(frozen)}
                tabIndex={x === 0 && y === 0 ? 0 : -1}
                onActivate={(cx, cy) => !disabled && onActivate?.({ x: cx, y: cy })}
                onKeyDown={(event, cx, cy) => onKeyDown?.(event, { x: cx, y: cy })}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
