"use client";

interface RematchBannerProps {
  requesterName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function RematchBanner({
  requesterName,
  onAccept,
  onDecline,
}: RematchBannerProps) {
  return (
    <div
      className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4"
      data-testid="rematch-banner"
    >
      <p className="text-sm font-medium text-white">
        {requesterName} wants a rematch!
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
          onClick={onAccept}
          data-testid="rematch-accept"
        >
          Accept
        </button>
        <button
          type="button"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          onClick={onDecline}
          data-testid="rematch-decline"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
