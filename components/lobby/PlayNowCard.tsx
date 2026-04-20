"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { startQueueAction } from "@/app/actions/matchmaking/startQueue";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import type { ModeSelection, PlayerIdentity } from "@/lib/types/match";

interface PlayNowCardProps {
  currentPlayer: PlayerIdentity;
}

interface ModePillDef {
  mode: ModeSelection;
  label: string;
  enabled: boolean;
}

const MODE_PILLS: ModePillDef[] = [
  { mode: "ranked", label: "Ranked", enabled: true },
  { mode: "casual", label: "Casual", enabled: false },
  { mode: "challenge", label: "Challenge", enabled: false },
];

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function PlayNowCard({ currentPlayer }: PlayNowCardProps) {
  const router = useRouter();
  const players = useLobbyPresenceStore((state) => state.players);
  const updateSelfStatus = useLobbyPresenceStore(
    (state) => state.updateSelfStatus,
  );

  const [mode, setMode] = useState<ModeSelection>("ranked");
  const [queueStartedAt, setQueueStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Looking for an opponent…",
  );
  const [pending, startTransition] = useTransition();
  const firstInteractionRef = useRef(false);

  const selfStatus =
    players.find((p) => p.id === currentPlayer.id)?.status ?? currentPlayer.status;
  const inMatch = selfStatus === "in_match";
  const queuing = queueStartedAt !== null;

  useEffect(() => {
    if (queueStartedAt === null) {
      return;
    }
    const tick = () =>
      setElapsedSeconds(Math.floor((Date.now() - queueStartedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [queueStartedAt]);

  useEffect(() => {
    if (queueStartedAt === null) {
      return;
    }
    let cancelled = false;
    const retry = async () => {
      const result = await startQueueAction();
      if (cancelled) {
        return;
      }
      if (result.status === "matched" && result.matchId) {
        setStatusMessage("Match found. Loading…");
        updateSelfStatus("in_match");
        router.push(`/match/${result.matchId}`);
      }
    };
    const interval = setInterval(retry, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [queueStartedAt, router, updateSelfStatus]);

  const markFirstInteraction = useCallback(() => {
    if (firstInteractionRef.current) {
      return;
    }
    firstInteractionRef.current = true;
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark("lobby:first-interaction");
    }
  }, []);

  const handlePlay = () => {
    markFirstInteraction();
    setStatusMessage("Looking for an opponent…");
    setElapsedSeconds(0);
    setQueueStartedAt(Date.now());
    updateSelfStatus("matchmaking");
    startTransition(async () => {
      const result = await startQueueAction();
      if (result.status === "matched" && result.matchId) {
        setStatusMessage("Match found. Loading…");
        updateSelfStatus("in_match");
        router.push(`/match/${result.matchId}`);
        return;
      }
      if (result.status === "queued") {
        setStatusMessage("Looking for an opponent…");
        return;
      }
      setQueueStartedAt(null);
      updateSelfStatus("available");
      setStatusMessage(result.message ?? "Matchmaking failed. Try again.");
    });
  };

  const handleCancel = () => {
    setQueueStartedAt(null);
    setElapsedSeconds(0);
    updateSelfStatus("available");
    setStatusMessage("Looking for an opponent…");
  };

  return (
    <Card elevation={0} className="lobby-cta-card space-y-5 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">
            Ready to play?
          </p>
          <p className="text-sm text-text-secondary">
            Drop into a ranked match against someone near your rating.
          </p>
        </div>
        <span className="hidden font-display text-xs uppercase tracking-[0.3em] text-accent-focus/70 sm:inline">
          {currentPlayer.eloRating ?? 1200} Elo
        </span>
      </div>

      <div
        role="group"
        aria-label="Match mode"
        className="flex flex-wrap gap-2"
      >
        {MODE_PILLS.map((pill) => {
          const selected = mode === pill.mode;
          const baseClasses =
            "rounded-full border px-3 py-1 text-xs font-medium transition min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0";
          const stateClasses = pill.enabled
            ? selected
              ? "border-ink bg-ink text-paper"
              : "border-hair-strong bg-paper text-ink hover:border-ochre-deep"
            : "cursor-not-allowed border-hair bg-paper-2 text-ink-soft";
          return (
            <button
              key={pill.mode}
              type="button"
              data-testid={`mode-pill-${pill.mode}`}
              aria-pressed={pill.enabled ? selected : undefined}
              aria-disabled={pill.enabled ? undefined : "true"}
              aria-label={
                pill.enabled ? pill.label : `${pill.label} — coming soon`
              }
              title={pill.enabled ? undefined : "Coming soon"}
              onClick={() => {
                markFirstInteraction();
                if (pill.enabled) {
                  setMode(pill.mode);
                }
              }}
              onFocus={markFirstInteraction}
              className={`${baseClasses} ${stateClasses}`}
            >
              {pill.label}
              {pill.enabled ? null : (
                <span className="ml-1 text-[10px] opacity-70">
                  (Coming soon)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {queuing ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            data-testid="matchmaker-queue-status"
            role="status"
            aria-live="polite"
            className="flex-1 rounded-lg border border-accent-focus/30 bg-accent-focus/5 px-4 py-3 text-sm text-text-primary"
          >
            <p>{statusMessage}</p>
            <p className="mt-1 text-xs text-text-muted">
              {formatElapsed(elapsedSeconds)} elapsed
            </p>
          </div>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePlay}
          onFocus={markFirstInteraction}
          disabled={inMatch || pending}
          data-testid="matchmaker-start-button"
          aria-label={
            inMatch ? "You are already in a match" : "Play Now"
          }
          className="lobby-primary-cta lobby-playnow-sticky inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-display text-lg font-semibold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-focus sm:text-xl"
        >
          {inMatch ? (
            "Already in a match"
          ) : pending ? (
            "Joining…"
          ) : (
            <>
              Play Now
              <span aria-hidden="true" className="text-base opacity-70">
                ·
              </span>
              <span className="text-sm font-normal opacity-80">
                {mode === "ranked" ? "Ranked" : mode}
              </span>
            </>
          )}
        </button>
      )}
    </Card>
  );
}
