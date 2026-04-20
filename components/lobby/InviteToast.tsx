"use client";

import { PlayerAvatar } from "@/components/match/PlayerAvatar";

export interface InviteToastInvite {
  inviteId: string;
  fromDisplayName: string;
  fromUsername: string;
  fromElo: number;
  yourElo: number;
}

interface InviteToastProps {
  invite: InviteToastInvite;
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onClose: () => void;
}

function formatRating(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function InviteToast({
  invite,
  onAccept,
  onDecline,
  onClose,
}: InviteToastProps) {
  return (
    <div
      data-testid="invite-toast"
      role="alert"
      className="fixed right-6 top-20 z-50 w-[340px] overflow-hidden rounded-xl border border-hair-strong bg-paper shadow-wottle-lg"
      style={{ borderLeft: "4px solid var(--ochre-deep)" }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <PlayerAvatar
          displayName={invite.fromDisplayName}
          avatarUrl={null}
          playerColor="oklch(0.56 0.08 220)"
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ochre-deep">
            Challenge received
          </p>
          <p className="truncate text-[14px] font-medium text-ink">
            {invite.fromDisplayName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss challenge"
          className="inline-flex h-11 w-11 items-center justify-center rounded text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div className="border-t border-hair px-4 py-3">
        <p className="text-[13px] leading-[1.5] text-ink-3">
          <span className="font-medium text-ink">Ranked</span> · 10 rounds · your
          rating{" "}
          <b className="font-mono text-ink">{formatRating(invite.yourElo)}</b>{" "}
          vs <b className="font-mono text-ink">{formatRating(invite.fromElo)}</b>.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDecline(invite.inviteId)}
            className="flex-1 rounded-lg border border-hair-strong px-3 py-2 text-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onAccept(invite.inviteId)}
            className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper hover:bg-ink-2"
          >
            Accept →
          </button>
        </div>
      </div>
    </div>
  );
}
