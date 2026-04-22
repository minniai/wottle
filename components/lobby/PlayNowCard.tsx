"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { useLobbyPresenceStore } from "@/lib/matchmaking/presenceStore";
import type { PlayerIdentity } from "@/lib/types/match";

interface PlayNowCardProps {
  currentPlayer: PlayerIdentity;
}

interface ModePillDef {
  mode: "ranked" | "casual" | "challenge";
  label: string;
  enabled: boolean;
}

const MODE_PILLS: ModePillDef[] = [
  { mode: "ranked", label: "Ranked", enabled: true },
  { mode: "casual", label: "Casual", enabled: false },
  { mode: "challenge", label: "Challenge", enabled: false },
];

export function PlayNowCard({ currentPlayer }: PlayNowCardProps) {
  const router = useRouter();
  const players = useLobbyPresenceStore((state) => state.players);
  const firstInteractionRef = useRef(false);

  const selfStatus =
    players.find((p) => p.id === currentPlayer.id)?.status ??
    currentPlayer.status;
  const inMatch = selfStatus === "in_match";

  const markFirstInteraction = useCallback(() => {
    if (firstInteractionRef.current) return;
    firstInteractionRef.current = true;
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark("lobby:first-interaction");
    }
  }, []);

  const handlePlay = () => {
    markFirstInteraction();
    router.push("/matchmaking");
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
        <span className="hidden font-display text-xs uppercase tracking-[0.3em] text-ochre-deep sm:inline">
          {currentPlayer.eloRating ?? 1200} Elo
        </span>
      </div>

      <div
        role="group"
        aria-label="Match mode"
        className="flex flex-wrap gap-2"
      >
        {MODE_PILLS.map((pill) => {
          const baseClasses =
            "rounded-full border px-3 py-1 text-xs font-medium transition min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0";
          const stateClasses = pill.enabled
            ? "border-ink bg-ink text-paper"
            : "cursor-not-allowed border-hair bg-paper-2 text-ink-soft";
          return (
            <button
              key={pill.mode}
              type="button"
              data-testid={`mode-pill-${pill.mode}`}
              aria-pressed={pill.enabled ? true : undefined}
              aria-disabled={pill.enabled ? undefined : "true"}
              aria-label={
                pill.enabled ? pill.label : `${pill.label} — coming soon`
              }
              title={pill.enabled ? undefined : "Coming soon"}
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

      <button
        type="button"
        onClick={handlePlay}
        onFocus={markFirstInteraction}
        disabled={inMatch}
        data-testid="matchmaker-start-button"
        aria-label={inMatch ? "You are already in a match" : "Play Now"}
        className="lobby-primary-cta lobby-playnow-sticky inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-display text-lg font-semibold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-focus sm:text-xl"
      >
        {inMatch ? "Already in a match" : "Play Now · Ranked"}
      </button>
    </Card>
  );
}
