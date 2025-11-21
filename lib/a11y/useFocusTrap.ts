"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface FocusTrapOptions {
  isActive: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  restoreFocus?: boolean;
}

export function useFocusTrap({
  isActive,
  containerRef,
  initialFocusRef,
  onEscape,
  restoreFocus = true,
}: FocusTrapOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus?.();
      }
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const ownerDocument = container.ownerDocument ?? document;
    previousFocusRef.current = ownerDocument.activeElement as HTMLElement | null;

    const getFocusableElements = () => {
      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      return nodes.filter(
        (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
      );
    };

    const focusFirstElement = () => {
      const focusables = getFocusableElements();
      const preferred =
        initialFocusRef?.current && focusables.includes(initialFocusRef.current)
          ? initialFocusRef.current
          : focusables[0];
      (preferred ?? container).focus();
    };

    focusFirstElement();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const currentIndex = focusables.indexOf(
        ownerDocument.activeElement as HTMLElement,
      );
      let nextIndex = currentIndex;

      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
      }

      event.preventDefault();
      focusables[nextIndex]?.focus();
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus?.();
      }
    };
  }, [isActive, containerRef, initialFocusRef, onEscape, restoreFocus]);
}


