"use client";

import { useState, type KeyboardEvent } from "react";

import { LobbyCard } from "@/components/lobby/LobbyCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { orderDirectory } from "@/lib/lobby/directoryOrdering";
import type { PlayerIdentity } from "@/lib/types/match";

type ConnectionStatus = "idle" | "connecting" | "ready" | "error";

interface LobbyDirectoryProps {
  players: PlayerIdentity[];
  selfId: string;
  viewerRating: number;
  connectionStatus: ConnectionStatus;
  onChallenge: (playerId: string) => void;
  onUsernameClick?: (playerId: string) => void;
  onCardKeyDown?: (
    playerId: string,
    event: KeyboardEvent<HTMLDivElement>,
  ) => void;
  registerCardRef?: (playerId: string, node: HTMLDivElement | null) => void;
}

function SkeletonRow() {
  return (
    <div
      data-testid="lobby-skeleton-card"
      className="flex items-center gap-3 rounded-2xl bg-surface-1 p-5"
    >
      <Skeleton shape="circle" className="h-12 w-12 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

function EmptyState() {
  const copyInviteLink = () => {
    if (typeof window === "undefined" || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(window.location.origin);
  };
  return (
    <div
      data-testid="lobby-empty-state"
      className="rounded-2xl border border-dashed border-surface-3 bg-surface-0 p-6 text-center"
    >
      <p className="text-sm font-semibold text-text-primary">
        No other players yet
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        Share the invite link with a friend to start a match.
      </p>
      <div className="mt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={copyInviteLink}
          aria-label="Copy invite link"
        >
          Copy invite link
        </Button>
      </div>
    </div>
  );
}

export function LobbyDirectory({
  players,
  selfId,
  viewerRating,
  connectionStatus,
  onChallenge,
  onUsernameClick,
  onCardKeyDown,
  registerCardRef,
}: LobbyDirectoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (connectionStatus !== "ready") {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  const { visible, hidden } = orderDirectory({
    players,
    selfId,
    viewerRating,
  });

  const others = visible.filter((p) => p.id !== selfId);
  if (others.length === 0 && hidden.length === 0) {
    return <EmptyState />;
  }

  const rendered = expanded ? [...visible, ...hidden] : visible;

  return (
    <div className="space-y-4">
      <div
        className="grid gap-3 md:grid-cols-2"
        role="list"
        aria-label="Online players"
      >
        {rendered.map((p) => (
          <LobbyCard
            key={p.id}
            player={p}
            isSelf={p.id === selfId}
            viewerRating={viewerRating}
            onChallenge={onChallenge}
            onUsernameClick={onUsernameClick}
            onKeyDown={
              onCardKeyDown ? (event) => onCardKeyDown(p.id, event) : undefined
            }
            ref={(node) => registerCardRef?.(p.id, node)}
          />
        ))}
      </div>
      {hidden.length > 0 && !expanded ? (
        <Button
          variant="secondary"
          size="md"
          onClick={() => setExpanded(true)}
          data-testid="lobby-directory-show-all"
          className="w-full"
        >
          Show all {visible.length + hidden.length} players
        </Button>
      ) : null}
    </div>
  );
}
