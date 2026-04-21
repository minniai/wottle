const LETTERS = ["W", "O", "T", "T", "L", "E"] as const;

export function LandingTileVignette() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-1 opacity-90"
      >
        {LETTERS.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            data-testid="landing-tile"
            className="tile tile--letterpress flex h-14 w-14 items-center justify-center rounded-md font-display text-2xl font-semibold text-ink"
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        WO-rd · ba-TTLE
      </p>
    </div>
  );
}
