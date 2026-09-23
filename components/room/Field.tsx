"use client";

import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import type { Language } from "@/lib/types/game-config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { letterValue } from "@/lib/room/liveState";
import type { Seat } from "@/lib/constants/seatColors";
import type { Coordinate } from "@/lib/types/board";
import type { FrozenTileMap, PlayerSlot } from "@/lib/types/match";
import { ownerSeatOf, type WordBand } from "@/lib/room/bandGeometry";
import { FieldBands } from "./FieldBands";
import { FieldCell, type CellState } from "./FieldCell";

export interface FieldProps {
  board: string[][];
  /** Whose letter values the gutters show (spec 060); the page's game language unless a match says otherwise. */
  language?: Language;
  frozenTiles?: FrozenTileMap;
  viewerSlot: PlayerSlot | null;
  /** Names by slot for the frozen-cell label (`frozen by Kári`). */
  ownerNames?: Partial<Record<PlayerSlot, string>>;
  disabled?: boolean;
  /** Framed 3px in this seat's colour while the move is theirs (spec 048 FR-020). */
  turnFrame?: Seat | null;
  /** Scored words drawn as bands under the cells (design system §5.2). */
  bands?: WordBand[];
  /** The ledger row under the pointer: both seats' bands for that move light up. */
  highlightMove?: number | null;
  drawnCount?: number | null;
  drawingIndex?: number | null;
  /** Queue: only the first `landedCount` letters (reading order) are shown; null = all. */
  landedCount?: number | null;
  cellStateFor?: (coord: Coordinate, base: CellState) => CellState;
  seatFor?: (coord: Coordinate) => Seat | null;
  shakeAt?: Coordinate | null;
  focusAt?: Coordinate | null;
  onActivate?: (coord: Coordinate) => void;
  /** Pointer down on one letter, up on another (spec 045 FR-024). */
  onDrag?: (from: Coordinate, to: Coordinate) => void;
  /** The two cells whose letters have just traded places; they travel (FR-027). */
  exchange?: [Coordinate, Coordinate] | null;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, coord: Coordinate) => void;
  /** Each player's last swap: a 2px tick on those cells in the mover's colour (spec 068 FR-027). */
  ticks?: Array<{ at: Coordinate; seat: Seat; name: string }>;
}

/**
 * The field (design system §5.1): a hundred capitals on paper, 1px rules,
 * 1.5px ink frame, value numeral in the top-right gutter. Static in P1; the
 * pick/commit reducer drives it from P3 through `cellStateFor`.
 */
export function Field(props: FieldProps) {
  const { THE_FIELD } = useCopy();
  const pageLanguage = useLocale().language;
  const {
    board,
    language = pageLanguage,
    frozenTiles = {},
    viewerSlot,
    ownerNames = {},
    disabled,
    turnFrame = null,
    bands = [],
    highlightMove = null,
    drawnCount = null,
    drawingIndex = null,
    landedCount = null,
  } = props;
  // A letter under any band is scored; its colour is its frozen owner's
  // (spec 049 US2). A live band's letters are not frozen yet: they take the
  // band's seat until the freeze lands.
  const tickAt = new Map((props.ticks ?? []).map((t) => [`${t.at.x},${t.at.y}`, { seat: t.seat, name: t.name }]));
  const covering = useMemo(() => {
    const map = new Map<string, Seat>();
    for (const band of bands) for (const c of band.wordCells) map.set(`${c.x},${c.y}`, band.seat);
    return map;
  }, [bands]);
  const { cellStateFor, seatFor, shakeAt, focusAt, onActivate, onDrag, onKeyDown, exchange = null } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const dragFrom = useRef<Coordinate | null>(null);
  /** Set when a drag resolves, so the click the browser fires next is not a tap. */
  const swallowClick = useRef(false);

  const onPointerDown = useCallback((x: number, y: number) => {
    dragFrom.current = { x, y };
    // A drag's click lands on the grid, not a letter, so nothing consumed the flag.
    swallowClick.current = false;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (!from) return;
      // jsdom has no hit testing; in a browser this is the cell under the finger.
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const cell = under?.closest<HTMLElement>("[data-x][data-y]") ?? null;
      if (!cell || !ref.current?.contains(cell)) {
        swallowClick.current = true;
        return;
      }
      const to = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
      if (to.x === from.x && to.y === from.y) return; // a tap; let the click run
      swallowClick.current = true;
      onDrag?.(from, to);
    },
    [onDrag],
  );

  const onActivateCell = useCallback(
    (x: number, y: number) => {
      if (swallowClick.current) {
        swallowClick.current = false;
        return;
      }
      onActivate?.({ x, y });
    },
    [onActivate],
  );

  // FLIP: each letter starts at the other's offset and animates home. The
  // offset is the distance between the two cells, so it needs no measurement
  // before the swap — the grid is uniform.
  // Keyed on the pair's cells, not its array: a re-render (every clock tick)
  // hands a fresh array for the same pair, and the letters must not fly again.
  const [travelling, setTravelling] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const exchangeKey = exchange ? exchange.map((c) => `${c.x},${c.y}`).join("|") : null;
  useEffect(() => {
    if (!exchangeKey) return setTravelling(new Map());
    const [a, b] = exchangeKey.split("|").map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y };
    });
    const cellOf = (c: Coordinate) => ref.current?.querySelector<HTMLElement>(`[data-x="${c.x}"][data-y="${c.y}"]`);
    const boxA = cellOf(a)?.getBoundingClientRect();
    const boxB = cellOf(b)?.getBoundingClientRect();
    if (!boxA || !boxB) return;
    setTravelling(
      new Map([
        [`${a.x},${a.y}`, { dx: boxB.left - boxA.left, dy: boxB.top - boxA.top }],
        [`${b.x},${b.y}`, { dx: boxA.left - boxB.left, dy: boxA.top - boxB.top }],
      ]),
    );
  }, [exchangeKey]);

  const onExchangeEnd = useCallback((x: number, y: number) => {
    setTravelling((current) => {
      if (!current.has(`${x},${y}`)) return current;
      const next = new Map(current);
      next.delete(`${x},${y}`);
      return next;
    });
  }, []);

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
      aria-label={THE_FIELD}
      data-testid="field"
      data-disabled={disabled || undefined}
      data-turn={turnFrame ?? undefined}
    >
      <FieldBands
        bands={bands}
        highlightMove={highlightMove}
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
            const bandSeat = covering.get(key) ?? null;
            const base: CellState = bandSeat ? "scored" : frozen ? "frozen" : "free";
            const state = cellStateFor ? cellStateFor({ x, y }, base) : base;
            const seat = seatFor?.({ x, y }) ?? ownerSeatOf(frozenTiles, { x, y }, viewerSlot) ?? bandSeat;
            return (
              <FieldCell
                key={key}
                x={x}
                y={y}
                letter={landed ? letter : ""}
                value={landed ? letterValue(letter, language) : 0}
                landing={landedCount !== null && index === landedCount - 1}
                state={state}
                seat={seat}
                ownerName={frozen ? ownerNames[frozen.owner] : undefined}
                shake={shakeAt?.x === x && shakeAt?.y === y}
                disabled={disabled || Boolean(frozen)}
                tabIndex={x === 0 && y === 0 ? 0 : -1}
                onActivate={(cx, cy) => !disabled && onActivateCell(cx, cy)}
                onPointerDown={(cx, cy) => !disabled && onPointerDown(cx, cy)}
                onPointerUp={onPointerUp}
                exchange={travelling.get(key) ?? null}
                onExchangeEnd={onExchangeEnd}
                onKeyDown={(event, cx, cy) => onKeyDown?.(event, { x: cx, y: cy })}
                lastMove={tickAt.get(key) ?? null}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
