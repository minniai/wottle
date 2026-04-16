"use client";

import { forwardRef } from "react";
import type { KeyboardEventHandler } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LobbyStatus, PlayerIdentity } from "@/lib/types/match";

interface LobbyCardProps {
  player: PlayerIdentity;
  isSelf?: boolean;
  tabIndex?: number;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  ariaLabel?: string;
  viewerRating?: number;
  onUsernameClick?: (playerId: string) => void;
  onChallenge?: (playerId: string) => void;
}

const STATUS_LABELS: Record<LobbyStatus, string> = {
  available: "Available",
  matchmaking: "Matchmaking",
  in_match: "In Match",
  offline: "Offline",
};

const STATUS_BADGE_VARIANT: Record<LobbyStatus, BadgeVariant> = {
  available: "available",
  matchmaking: "matchmaking",
  in_match: "in_match",
  offline: "offline",
};

export const LobbyCard = forwardRef<HTMLDivElement, LobbyCardProps>(
  function LobbyCard(
    {
      player,
      isSelf = false,
      tabIndex = 0,
      onKeyDown,
      ariaLabel,
      viewerRating,
      onUsernameClick,
      onChallenge,
    },
    ref,
  ) {
    const displayRating = player.eloRating ?? 1200;
    const statusLabel = STATUS_LABELS[player.status] ?? player.status;
    const statusVariant = STATUS_BADGE_VARIANT[player.status] ?? "offline";
    const isAvailable = player.status === "available";
    const canChallenge = !isSelf && player.status !== "offline";
    const challengeDisabled = player.status === "in_match";

    return (
      <Card
        elevation={1}
        data-testid="lobby-card"
        data-player-id={player.id}
        data-player-username={player.username}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        role="listitem"
        aria-label={
          ariaLabel ??
          `${player.displayName ?? player.username}, ${statusLabel}`
        }
        className={`space-y-3 ${isSelf ? "ring-2 ring-accent-focus/60" : ""}`}
        ref={ref}
      >
        <div className="flex items-start gap-3">
          <Avatar
            playerId={player.id}
            displayName={player.displayName ?? player.username}
            avatarUrl={player.avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="truncate text-left text-sm font-semibold text-text-primary transition hover:text-accent-focus focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-focus"
              onClick={(e) => {
                e.stopPropagation();
                onUsernameClick?.(player.id);
              }}
              data-testid="lobby-username-btn"
            >
              {player.displayName ?? player.username}
            </button>
            <p className="truncate text-xs text-text-muted">
              @{player.username}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              data-testid="lobby-elo-rating"
              className="font-mono text-xs font-medium text-text-primary"
            >
              {displayRating}
            </span>
            {viewerRating !== undefined ? (
              <EloDiffBadge
                playerRating={displayRating}
                viewerRating={viewerRating}
              />
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span data-testid="lobby-status-pill">
            <Badge variant={statusVariant} pulse={isAvailable}>
              {isSelf ? "You" : statusLabel}
            </Badge>
          </span>
          {canChallenge ? (
            <Button
              size="sm"
              variant={challengeDisabled ? "secondary" : "primary"}
              disabled={challengeDisabled}
              aria-disabled={challengeDisabled ? "true" : undefined}
              aria-label={
                challengeDisabled
                  ? `Challenge ${player.displayName ?? player.username} — already in a match`
                  : `Challenge ${player.displayName ?? player.username}`
              }
              onClick={(e) => {
                e.stopPropagation();
                if (!challengeDisabled) {
                  onChallenge?.(player.id);
                }
              }}
            >
              Challenge
            </Button>
          ) : null}
        </div>
      </Card>
    );
  },
);

function EloDiffBadge({
  playerRating,
  viewerRating,
}: {
  playerRating: number;
  viewerRating: number;
}) {
  const diff = playerRating - viewerRating;
  const label = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "±0";
  const color =
    diff > 0
      ? "text-emerald-400"
      : diff < 0
        ? "text-rose-400"
        : "text-text-muted";
  return (
    <span data-testid="lobby-elo-diff" className={`font-mono text-xs ${color}`}>
      {label}
    </span>
  );
}
