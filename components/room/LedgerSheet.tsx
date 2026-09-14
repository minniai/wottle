"use client";

import { useRef, type ReactNode } from "react";

import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

interface LedgerSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Below 900px the ledger collapses to its live row; the rest opens as a sheet
 * from that row (design system §4). Plain, focus-trapped, no backdrop over the field.
 */
export function LedgerSheet({ open, onClose, children }: LedgerSheetProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap({ isActive: open, containerRef: ref, onEscape: onClose });
  if (!open) return null;
  return (
    <div ref={ref} className="ledger-sheet" role="region" aria-label="ledger" data-testid="ledger-sheet">
      <button type="button" className="action-secondary ledger-sheet__close" data-testid="ledger-sheet-close" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  );
}
