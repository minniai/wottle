"use client";

import { useEffect, useState, type RefObject } from "react";

/** Line count of each measured element: rendered height ÷ line-height (fold rule input). */
export function countLines(el: HTMLElement): number {
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
  return Math.max(1, Math.round(el.offsetHeight / lineHeight));
}

export function useMeasuredLines(containerRef: RefObject<HTMLElement | null>, selector: string, deps: unknown[]): number[] {
  const [lines, setLines] = useState<number[]>([]);
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const measure = () => setLines(Array.from(root.querySelectorAll<HTMLElement>(selector)).map(countLines));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, selector, ...deps]);
  return lines;
}
