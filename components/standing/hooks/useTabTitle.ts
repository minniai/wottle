"use client";

import { useEffect, useRef } from "react";

/** Writes the page's tab title while `title` is set, and puts the page's own title back after (FR-011). */
export function useTabTitle(title: string | null): void {
  const own = useRef<string | null>(null);
  useEffect(() => {
    if (title === null) return;
    own.current ??= document.title;
    document.title = title;
  }, [title]);
  useEffect(() => {
    if (title !== null || own.current === null) return;
    document.title = own.current;
    own.current = null;
  }, [title]);
}
