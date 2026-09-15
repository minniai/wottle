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
}

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
  { barHeight = BAR_HEIGHT_PX, paddingX = 0 }: FieldSizeOptions = {},
): number {
  const available = height - 2 * barHeight - 2 * BAR_GAP_PX - ROOM_PADDING_PX;
  return Math.max(0, Math.floor(Math.min(available, width - paddingX, FIELD_MAX_PX)));
}

function phoneBarHeight(): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return BAR_HEIGHT_PX;
  return window.matchMedia(PHONE_QUERY).matches ? PHONE_BAR_HEIGHT_PX : BAR_HEIGHT_PX;
}

function horizontalPadding(el: HTMLElement): number {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return 0;
  const style = window.getComputedStyle(el);
  return (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
}

/**
 * Field size from the room's real box (ResizeObserver), never from viewport
 * units — browser chrome and on-screen keyboards change the box, not `100vh`.
 */
export function useFieldSize(roomRef: RefObject<HTMLElement | null>): number {
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = roomRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      setSize(
        computeFieldSize(el.clientWidth, el.clientHeight, {
          barHeight: phoneBarHeight(),
          paddingX: horizontalPadding(el),
        }),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [roomRef]);

  return size;
}
