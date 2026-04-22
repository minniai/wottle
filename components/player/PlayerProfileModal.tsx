"use client";

import { useEffect, useId, useState } from "react";

import { getPlayerProfile } from "@/app/actions/player/getPlayerProfile";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import { ProfileActions } from "@/components/player/ProfileActions";
import { ProfileFormChips } from "@/components/player/ProfileFormChips";
import { ProfileSparkline } from "@/components/player/ProfileSparkline";
import type { PlayerProfile } from "@/lib/types/match";

interface PlayerProfileModalProps {
  playerId: string;
  viewerId: string;
  onClose: () => void;
  onChallenge: (playerId: string) => void;
}

export function PlayerProfileModal({
  playerId,
  viewerId,
  onClose,
  onChallenge,
}: PlayerProfileModalProps) {
  const titleId = useId();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getPlayerProfile(playerId);
      if (cancelled) return;
      if (result.status === "ok" && result.profile) {
        setProfile(result.profile);
      } else {
        setError(result.error ?? "Unable to load profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const isSelf = viewerId === playerId;
  const firstName =
    profile?.identity.displayName?.split(/\s+/)[0] ??
    profile?.identity.username ??
    "Player";

  return (
    <Dialog open onClose={onClose} ariaLabelledBy={titleId}>
      {profile ? (
        <div
          data-testid="player-profile-modal"
          className="flex flex-col gap-6"
        >
          <header className="flex items-start gap-4">
            <Avatar
              playerId={profile.identity.id}
              displayName={profile.identity.displayName ?? profile.identity.username}
              avatarUrl={profile.identity.avatarUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                {isSelf ? "Your profile" : "Player profile"}
              </p>
              <h2
                id={titleId}
                className="font-display text-3xl font-semibold italic text-ink"
              >
                {profile.identity.displayName}
              </h2>
              <p className="font-mono text-[11px] text-ink-soft">
                @{profile.identity.username}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Rating"
              value={profile.stats.eloRating}
              emphasised
            />
            <StatTile label="Wins" value={profile.stats.wins} />
            <StatTile label="Losses" value={profile.stats.losses} />
            <BestWordTile bestWord={profile.bestWord} />
          </div>

          <ProfileSparkline
            ratings={profile.ratingHistory.map((r) => r.rating)}
            peak={profile.peakRating}
            current={profile.stats.eloRating}
          />

          <ProfileFormChips form={profile.form} />

          <ProfileActions
            firstName={firstName}
            isSelf={isSelf}
            onChallenge={() => onChallenge(playerId)}
            onClose={onClose}
          />
        </div>
      ) : error ? (
        <div role="alert" data-testid="player-profile-modal-error">
          <p id={titleId} className="font-display text-lg text-bad">
            Unable to load profile
          </p>
          <p className="mt-2 text-sm text-ink-3">{error}</p>
        </div>
      ) : (
        <div data-testid="player-profile-modal-loading">
          <p id={titleId} className="font-display text-lg text-ink">
            Loading profile…
          </p>
        </div>
      )}
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: number | string;
  emphasised?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hair bg-paper-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          emphasised ? "text-ochre-deep" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BestWordTile({ bestWord }: { bestWord: PlayerProfile["bestWord"] }) {
  return (
    <div className="rounded-xl border border-hair bg-paper-2 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
        Best word
      </p>
      {bestWord ? (
        <>
          <p className="mt-1 font-display text-xl font-semibold text-ink">
            {bestWord.word}
          </p>
          <p className="font-mono text-[10px] text-ink-soft">
            {bestWord.points} pts
          </p>
        </>
      ) : (
        <p className="mt-1 font-display text-xl text-ink-soft">—</p>
      )}
    </div>
  );
}
