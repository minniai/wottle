"use client";

import type { PlayerIdentity } from "../../lib/types/match";

interface LobbyCardProps {
  player: PlayerIdentity;
  isSelf?: boolean;
}

const STATUS_LABELS: Record<PlayerIdentity["status"], string> = {
  available: "Available",
  matchmaking: "Matchmaking",
  in_match: "In Match",
  offline: "Offline",
};

const STATUS_STYLES: Record<PlayerIdentity["status"], string> = {
  available: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  matchmaking: "bg-amber-500/15 text-amber-100 border-amber-400/40",
  in_match: "bg-sky-500/15 text-sky-100 border-sky-400/40",
  offline: "bg-slate-600/20 text-slate-200 border-slate-600/40",
};

export function LobbyCard({ player, isSelf = false }: LobbyCardProps) {
  const statusLabel = STATUS_LABELS[player.status] ?? player.status;
  const statusStyles = STATUS_STYLES[player.status] ?? STATUS_STYLES.available;

  return (
    <article
      data-testid="lobby-card"
      data-player-id={player.id}
      data-player-username={player.username}
      className={`rounded-xl border border-white/10 bg-slate-900/40 p-4 shadow-lg shadow-slate-950/30 transition hover:border-white/20 ${
        isSelf ? "ring-2 ring-emerald-500/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {player.displayName ?? player.username}
          </p>
          <p className="text-xs text-white/60">@{player.username}</p>
        </div>
        <span
          data-testid="lobby-status-pill"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyles}`}
        >
          {isSelf ? "You" : statusLabel}
        </span>
      </div>

      <dl className="mt-4 text-xs text-white/60">
        <div className="flex items-center justify-between">
          <dt>Last seen</dt>
          <dd className="font-mono text-white/80">{formatLastSeen(player.lastSeenAt)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Status</dt>
          <dd className="capitalize text-white/80">{statusLabel.toLowerCase()}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatLastSeen(value: string | null | undefined): string {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


