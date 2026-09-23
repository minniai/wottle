"use client";

import { useEffect, useState, type RefObject } from "react";

export const FIELD_MAX_PX = 720;
const BAR_HEIGHT_PX = 60;
const PHONE_BAR_HEIGHT_PX = 56;
const PHONE_QUERY = "(max-width: 900px)";
const BAR_GAP_PX = 12;
const ROOM_PADDING_PX = 48;

export interface FieldSizeOptions {
  /** One bar; the stylesheet drops this to 56px below 900px. */
  barHeight?: number;
  /** The room's total horizontal padding — `clientWidth` includes it. */
  paddingX?: number;
  /** The ledger column beside the field on desktop; 0 when the room is one column. */
  ledgerWidth?: number;
  /** The gap between the field column and the ledger. */
  gutter?: number;
}

/** Where the match's facts sit around the field (spec 068): two bars, or one scoreboard above it. */
export type RoomLayout = "bars" | "scoreboard";

export interface FieldGeometry {
  /** One cell: a whole pixel count on desktop, so the ledger's rows can equal it. */
  cell: number;
  /** The field's outer size, frame included. */
  field: number;
}

export interface ScoreboardFieldOptions {
  paddingX?: number;
  ledgerWidth?: number;
  gutter?: number;
  /** One column: the ledger sits below the field, so nothing has to line up with its rows. */
  phone?: boolean;
}

/** The desktop cell never grows past the canvas's 71px (field 713). */
export const SCOREBOARD_CELL_MAX_PX = 71;
/** The field's 1.5px frame on each edge, outside the ten cells. */
const FIELD_FRAME_PX = 3;
/** Three 40px rows and their 1.5px frame; 34px rows on a phone. */
const SCOREBOARD_HEIGHT_PX = 3 * 40 + FIELD_FRAME_PX;
const PHONE_SCOREBOARD_HEIGHT_PX = 3 * 34 + FIELD_FRAME_PX;
const ROOM_PADDING_Y_PX = 48;
const PHONE_PADDING_Y_PX = 24;
/** The phone ledger block's floor under the field: its gap, the live row and the pinned foot. */
const PHONE_LEDGER_MIN_PX = 12 + 64 + 44;

/**
 * Largest square that fits under two bars and their gaps, capped at 720
 * (design system §4).
 *
 * The width must be the field's *real* width: `--cell-size` is derived from
 * this value, so an over-measure by the room's padding makes every letter and
 * numeral the wrong size (spec 045 FR-008, FR-022).
 */
export function computeFieldSize(
  width: number,
  height: number,
  { barHeight = BAR_HEIGHT_PX, paddingX = 0, ledgerWidth = 0, gutter = 0 }: FieldSizeOptions = {},
): number {
  const available = height - 2 * barHeight - 2 * BAR_GAP_PX - ROOM_PADDING_PX;
  return Math.max(0, Math.floor(Math.min(available, width - paddingX - ledgerWidth - gutter, FIELD_MAX_PX)));
}

/**
 * The field under a scoreboard (spec 068 FR-011, FR-013, FR-016). On desktop
 * the cell is a whole pixel count, so each ledger row can be exactly one cell
 * tall beside it, and the field is ten cells plus its frame. On a phone the
 * ledger sits below the field and the cell may be fractional.
 */
export function computeScoreboardField(width: number, height: number, options: ScoreboardFieldOptions = {}): FieldGeometry {
  const { paddingX = 0, ledgerWidth = 0, gutter = 0, phone = false } = options;
  if (phone) {
    const tall = height - PHONE_SCOREBOARD_HEIGHT_PX - BAR_GAP_PX - PHONE_PADDING_Y_PX - PHONE_LEDGER_MIN_PX;
    const field = Math.max(0, Math.floor(Math.min(tall, width - paddingX, FIELD_MAX_PX)));
    return { cell: field / 10, field };
  }
  const tall = height - SCOREBOARD_HEIGHT_PX - BAR_GAP_PX - ROOM_PADDING_Y_PX;
  const wide = width - paddingX - ledgerWidth - gutter;
  const cell = Math.max(0, Math.min(SCOREBOARD_CELL_MAX_PX, Math.floor((Math.min(tall, wide) - FIELD_FRAME_PX) / 10)));
  return { cell, field: cell > 0 ? cell * 10 + FIELD_FRAME_PX : 0 };
}

function isPhone(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

function computedPx(style: CSSStyleDeclaration, property: string): number {
  return Number.parseFloat(style.getPropertyValue(property)) || 0;
}

/** The room's box as the sizing needs it: padding, and on desktop the ledger column and gutter beside the field. */
function measureRoom(el: HTMLElement): { width: number; height: number; paddingX: number; ledgerWidth: number; gutter: number; phone: boolean } {
  const phone = isPhone();
  const style = typeof window !== "undefined" && typeof window.getComputedStyle === "function" ? window.getComputedStyle(el) : null;
  const paddingX = style ? computedPx(style, "padding-left") + computedPx(style, "padding-right") : 0;
  const ledgerWidth = style && !phone ? computedPx(style, "--ledger-width") : 0;
  const gutter = style && !phone ? computedPx(style, "--room-gutter") : 0;
  return { width: el.clientWidth, height: el.clientHeight, paddingX, ledgerWidth, gutter, phone };
}

function geometryFor(el: HTMLElement, layout: RoomLayout): FieldGeometry {
  const room = measureRoom(el);
  if (layout === "scoreboard") return computeScoreboardField(room.width, room.height, room);
  const field = computeFieldSize(room.width, room.height, { ...room, barHeight: room.phone ? PHONE_BAR_HEIGHT_PX : BAR_HEIGHT_PX });
  return { cell: field / 10, field };
}

/**
 * Field geometry from the room's real box (ResizeObserver), never from viewport
 * units — browser chrome and on-screen keyboards change the box, not `100vh`.
 */
export function useFieldGeometry(roomRef: RefObject<HTMLElement | null>, layout: RoomLayout = "bars"): FieldGeometry {
  const [geometry, setGeometry] = useState<FieldGeometry>({ cell: 0, field: 0 });

  useEffect(() => {
    const el = roomRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setGeometry(geometryFor(el, layout));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [roomRef, layout]);

  return geometry;
}

/** The bars layout's field size (lobby, queue): the square under two bars. */
export function useFieldSize(roomRef: RefObject<HTMLElement | null>): number {
  return useFieldGeometry(roomRef, "bars").field;
}
