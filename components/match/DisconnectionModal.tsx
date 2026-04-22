"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCountdown } from "@/components/match/useCountdown";

interface DisconnectionModalProps {
  opponentDisplayName: string;
  disconnectedAt: number;
  windowMs: number;
  onClose: () => void;
  onClaimWin: () => void;
  isClaiming: boolean;
}

function formatCountdown(remaining: number): string {
  const clamped = Math.max(0, remaining);
  const minutes = Math.floor(clamped / 60);
  const seconds = (clamped % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function DisconnectionModal({
  opponentDisplayName,
  disconnectedAt,
  windowMs,
  onClose,
  onClaimWin,
  isClaiming,
}: DisconnectionModalProps) {
  const titleId = useId();
  // Snap Date.now() once at mount so the countdown anchor is stable across
  // re-renders (Date.now() inside the render body would be impure per React 19).
  const [startSeconds] = useState(() =>
    Math.max(0, Math.round((disconnectedAt + windowMs - Date.now()) / 1000)),
  );
  const { remaining, expired } = useCountdown(startSeconds);
  const canClaim = expired && !isClaiming;

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabelledBy={titleId}
      bottomSheetOnMobile={false}
    >
      <div
        data-testid="disconnection-modal"
        className="flex flex-col items-center gap-5 text-center"
      >
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-warn" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-warn">
          Connection lost
        </p>
        <h2
          id={titleId}
          className="font-display text-2xl font-semibold italic text-ink sm:text-3xl"
        >
          {opponentDisplayName} dropped out.
        </h2>
        <p className="max-w-xs text-sm text-ink-3">
          The match is paused. We&apos;ll wait up to 90 seconds for them to
          reconnect, or you can claim the win.
        </p>
        <p
          className="font-mono text-3xl tabular-nums tracking-[0.04em] text-ink"
          aria-live="polite"
        >
          {formatCountdown(remaining)}
        </p>
        <div className="mt-2 grid w-full grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isClaiming}>
            Keep waiting
          </Button>
          <Button onClick={onClaimWin} disabled={!canClaim}>
            {isClaiming ? "Claiming\u2026" : "Claim win"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
