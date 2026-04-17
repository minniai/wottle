"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  bottomSheetOnMobile?: boolean;
  children: ReactNode;
}

const BOTTOM_SHEET_CLASSES =
  "fixed bottom-0 left-0 right-0 rounded-t-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] " +
  "sm:static sm:mx-auto sm:mt-24 sm:max-w-lg sm:rounded-2xl sm:pb-6";

const CENTERED_CLASSES =
  "fixed left-1/2 top-1/2 w-[min(calc(100%-2rem),32rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6";

export function Dialog({
  open,
  onClose,
  ariaLabelledBy,
  ariaDescribedBy,
  bottomSheetOnMobile = true,
  children,
}: DialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    isActive: open,
    containerRef,
    onEscape: onClose,
  });

  if (!open || typeof document === "undefined") {
    return null;
  }

  const positionClasses = bottomSheetOnMobile
    ? BOTTOM_SHEET_CLASSES
    : CENTERED_CLASSES;

  return createPortal(
    <div
      data-testid="dialog-backdrop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        data-bottom-sheet={bottomSheetOnMobile ? "true" : "false"}
        tabIndex={-1}
        className={`bg-surface-1 text-text-primary shadow-2xl ${positionClasses}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
