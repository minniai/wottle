export function HowToPlayCard() {
  return (
    <div
      data-testid="how-to-play-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        How to play
      </div>
      <ol className="mt-2.5 list-decimal pl-5 text-[13px] leading-[1.7] text-ink-3">
        <li>Tap any unfrozen tile.</li>
        <li>Tap a second tile to swap.</li>
        <li>New 3+ letter words in any direction score.</li>
        <li>Claimed letters freeze in your color.</li>
      </ol>
    </div>
  );
}
