"use client";

import { useEffect, useRef } from "react";

export type MoveFeedbackVariant = "success" | "error";

export interface MoveFeedbackDetails {
  id: string;
  variant: MoveFeedbackVariant;
  message: string;
  title?: string;
}

interface MoveFeedbackProps {
  feedback: MoveFeedbackDetails | null;
  onDismiss?: () => void;
  autoHideMs?: number;
}

const BASE_CLASSES =
  "move-feedback relative mt-4 w-full max-w-md rounded-lg border px-5 py-4 text-sm shadow-lg outline-none transition focus-visible:ring-2 focus-visible:ring-ink-soft focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const SUCCESS_CLASSES = "border-emerald-400/60 bg-emerald-500/10 text-emerald-50";
const ERROR_CLASSES = "border-rose-500/70 bg-rose-500/15 text-rose-50";
const DEFAULT_AUTO_HIDE_MS = 6000;

export function MoveFeedback({
  feedback,
  onDismiss,
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
}: MoveFeedbackProps) {
  const toastRef = useRef<HTMLDivElement | null>(null);
  const lastFocusKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusKey = feedback ? `${feedback.id}:${feedback.variant}:${feedback.message}` : null;

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!feedback || feedback.variant !== "success" || !onDismiss || autoHideMs <= 0) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      onDismiss();
    }, autoHideMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [feedback, onDismiss, autoHideMs]);

  useEffect(() => {
    if (!focusKey) {
      lastFocusKeyRef.current = null;
      return;
    }

    if (focusKey === lastFocusKeyRef.current) {
      return;
    }

    lastFocusKeyRef.current = focusKey;

    const timer = setTimeout(() => {
      toastRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => clearTimeout(timer);
  }, [focusKey]);

  const liveRegionTone = feedback?.variant === "error" ? "assertive" : "polite";

  const toastClasses =
    feedback?.variant === "success"
      ? `${BASE_CLASSES} ${SUCCESS_CLASSES}`
      : `${BASE_CLASSES} ${ERROR_CLASSES}`;

  return (
    <>
      <div
        aria-atomic="true"
        aria-live={liveRegionTone}
        className="sr-only"
        data-testid="move-feedback-live-region"
      >
        {feedback?.message ?? ""}
      </div>
      {feedback ? (
        <div
          ref={toastRef}
          aria-atomic="true"
          aria-live={feedback.variant === "success" ? "polite" : "assertive"}
          className={toastClasses}
          data-variant={feedback.variant}
          data-testid="move-feedback-toast"
          role={feedback.variant === "success" ? "status" : "alert"}
          tabIndex={-1}
        >
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
              data-variant-indicator={feedback.variant}
              style={{
                backgroundColor:
                  feedback.variant === "success"
                    ? "rgba(34, 197, 94, 0.9)"
                    : "rgba(244, 63, 94, 0.9)",
              }}
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold">
                {feedback.title ??
                  (feedback.variant === "success" ? "Move accepted" : "Move rejected")}
              </p>
              <p className="text-sm text-ink-3">{feedback.message}</p>
            </div>
            {onDismiss ? (
              <button
                type="button"
                aria-label="Dismiss move feedback"
                className="ml-2 inline-flex flex-shrink-0 items-center justify-center rounded-md border border-hair-strong bg-paper-2 px-2 py-1 text-xs font-medium text-ink-3 transition hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-soft focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                data-testid="move-feedback-dismiss"
                onClick={() => {
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }

                  onDismiss?.();
                }}
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
