"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import type { PlayerProfile } from "@/lib/types/match";

type ProfileState = {
  profile: PlayerProfile | null;
  loading: boolean;
  error: string | null;
};

type ProfileAction =
  | { type: "loading" }
  | { type: "loaded"; profile: PlayerProfile }
  | { type: "error"; error: string };

function profileReducer(
  _state: ProfileState,
  action: ProfileAction,
): ProfileState {
  switch (action.type) {
    case "loading":
      return { profile: null, loading: true, error: null };
    case "loaded":
      return { profile: action.profile, loading: false, error: null };
    case "error":
      return { profile: null, loading: false, error: action.error };
  }
}

interface PlayerProfileModalProps {
  playerId: string;
  onClose: () => void;
}

export function PlayerProfileModal({
  playerId,
  onClose,
}: PlayerProfileModalProps) {
  const [state, dispatch] = useReducer(profileReducer, {
    profile: null,
    loading: true,
    error: null,
  });
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loading" });

    getPlayerProfile(playerId).then((result) => {
      if (cancelled) return;
      if (result.status === "ok" && result.profile) {
        dispatch({ type: "loaded", profile: result.profile });
      } else {
        dispatch({
          type: "error",
          error: result.error ?? "Player not found.",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const { profile, loading, error } = state;

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="player-profile-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Player Profile"
    >
      <div className="w-full max-w-sm rounded-2xl border border-hair bg-paper p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            Player Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-ink-soft">Loading...</p>
        )}

        {error && (
          <p className="mt-4 text-sm text-rose-400">{error}</p>
        )}

        {profile && <ProfileContent profile={profile} />}
      </div>
    </div>
  );
}

function ProfileContent({ profile }: { profile: PlayerProfile }) {
  const { identity, stats, ratingTrend } = profile;

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink">
          {identity.displayName}
        </p>
        <p className="text-xs text-ink-soft">
          @{identity.username}
        </p>
      </div>

      <div className="text-center">
        <p
          className="text-4xl font-bold text-ink"
          data-testid="profile-elo"
        >
          {stats.eloRating}
        </p>
        <p className="text-xs text-ink-soft">Elo Rating</p>
      </div>

      <div
        className="grid grid-cols-5 gap-2 text-center"
        data-testid="profile-stats"
      >
        <StatCell label="Games" value={stats.gamesPlayed} />
        <StatCell label="Wins" value={stats.wins} />
        <StatCell label="Losses" value={stats.losses} />
        <StatCell label="Draws" value={stats.draws} />
        <StatCell
          label="Win %"
          value={
            stats.winRate !== null
              ? `${Math.round(stats.winRate * 100)}%`
              : "—"
          }
        />
      </div>

      {ratingTrend.length > 0 && (
        <TrendDisplay trend={ratingTrend} />
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}

function TrendDisplay({ trend }: { trend: number[] }) {
  const direction = deriveTrendDirection(trend);
  const arrow =
    direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const color =
    direction === "up"
      ? "text-emerald-400"
      : direction === "down"
        ? "text-rose-400"
        : "text-ink-soft";

  return (
    <div data-testid="profile-trend">
      <p className="text-xs text-ink-soft">
        Last {trend.length} games
      </p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex gap-1 font-mono text-xs text-ink-3">
          {trend.map((rating, i) => (
            <span key={i}>{rating}</span>
          ))}
        </div>
        <span className={`text-lg font-bold ${color}`}>
          {arrow}
        </span>
      </div>
    </div>
  );
}

function deriveTrendDirection(
  trend: number[],
): "up" | "down" | "stable" {
  if (trend.length < 2) return "stable";
  const first = trend[0];
  const last = trend[trend.length - 1];
  if (last > first) return "up";
  if (last < first) return "down";
  return "stable";
}
