"use client";

import { useEffect, useState, type RefObject } from "react";

export const FIELD_MAX_PX = 720;
const BAR_HEIGHT_PX = 60;
const BAR_GAP_PX = 12;
const ROOM_PADDING_PX = 48;

/** Largest square that fits under two bars and their gaps, capped at 720 (design system §4). */
export function computeFieldSize(width: number, height: number, barHeight = BAR_HEIGHT_PX): number {
  const available = height - 2 * barHeight - 2 * BAR_GAP_PX - ROOM_PADDING_PX;
  return Math.max(0, Math.floor(Math.min(available, width, FIELD_MAX_PX)));
}

/**
 * Field size from the room's real box (ResizeObserver), never from viewport
 * units — browser chrome and on-screen keyboards change the box, not `100vh`.
 */
export function useFieldSize(roomRef: RefObject<HTMLElement | null>, barHeight = BAR_HEIGHT_PX): number {
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = roomRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSize(computeFieldSize(el.clientWidth, el.clientHeight, barHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [roomRef, barHeight]);

  return size;
}
