"use client";

import { useEffect } from "react";

import { TOAST_DEFAULT_DISMISS_MS } from "@/lib/constants/lobby";

export type ToastTone = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** null → manual-dismiss only; undefined → default dismiss ms. */
  autoDismissMs?: number | null;
}

interface ToastProps {
  message: ToastMessage;
  onDismiss: () => void;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-good/40 bg-good/10 text-good",
  error: "border-bad/50 bg-bad/10 text-bad",
  info: "border-ochre/40 bg-ochre/10 text-ochre-deep",
};

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (message.autoDismissMs === null) {
      return;
    }
    const ms = message.autoDismissMs ?? TOAST_DEFAULT_DISMISS_MS;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
  }, [message.autoDismissMs, onDismiss]);

  const role = message.tone === "error" ? "alert" : "status";
  const live = message.tone === "error" ? "assertive" : "polite";

  return (
    <div
      role={role}
      aria-live={live}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONE_STYLES[message.tone]}`}
    >
      <div className="flex-1">
        <p className="font-semibold">{message.title}</p>
        {message.description ? (
          <p className="mt-0.5 opacity-80">{message.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-current opacity-70 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-focus sm:min-h-0 sm:min-w-0"
      >
        ×
      </button>
    </div>
  );
}
