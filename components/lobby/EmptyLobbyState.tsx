interface EmptyLobbyStateProps {
  onJoinQueue: () => void;
}

export function EmptyLobbyState({ onJoinQueue }: EmptyLobbyStateProps) {
  return (
    <div
      data-testid="empty-lobby-state"
      className="flex flex-col items-center gap-5 rounded-xl border border-hair bg-paper px-6 py-16 text-center shadow-wottle-sm"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Nobody on the floor
      </p>
      <h3 className="font-display text-[42px] italic leading-tight text-ink">
        The library is empty tonight.
      </h3>
      <p className="max-w-[42ch] text-[15px] leading-[1.6] text-ink-3">
        No challengers online right now. Join the matchmaking queue and
        we&apos;ll notify you the moment a rated player arrives.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onJoinQueue}
          className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink-2"
        >
          ◆ Join the queue
        </button>
        <button
          type="button"
          disabled
          className="rounded-full border border-hair-strong px-5 py-3 text-sm text-ink-3 opacity-50"
        >
          Play a bot (coming soon)
        </button>
      </div>
    </div>
  );
}
