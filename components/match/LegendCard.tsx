type Slot = "p1" | "p2" | "both";

const SLOT_STYLES: Record<Slot, React.CSSProperties> = {
  p1: {
    background: "color-mix(in oklab, var(--p1-tint) 75%, var(--paper))",
    boxShadow: "inset 3px 0 0 var(--p1)",
  },
  p2: {
    background: "color-mix(in oklab, var(--p2-tint) 75%, var(--paper))",
    boxShadow: "inset 3px 0 0 var(--p2)",
  },
  both: {
    background:
      "linear-gradient(135deg, color-mix(in oklab, var(--p1-tint) 80%, var(--paper)) 50%, color-mix(in oklab, var(--p2-tint) 80%, var(--paper)) 50%)",
  },
};

function Swatch({ slot }: { slot: Slot }) {
  return (
    <span
      data-testid="legend-swatch"
      data-slot={slot}
      aria-hidden="true"
      className="inline-block h-[22px] w-[22px] flex-shrink-0 rounded-[4px] border border-hair"
      style={SLOT_STYLES[slot]}
    />
  );
}

export function LegendCard() {
  return (
    <div
      data-testid="legend-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Legend
      </div>
      <div className="mt-3 flex flex-col gap-2.5 text-[13px] text-ink-3">
        <div className="flex items-center gap-3">
          <Swatch slot="p1" />
          <span>Your territory</span>
        </div>
        <div className="flex items-center gap-3">
          <Swatch slot="p2" />
          <span>Opponent&apos;s territory</span>
        </div>
        <div className="flex items-center gap-3">
          <Swatch slot="both" />
          <span>Shared letter</span>
        </div>
      </div>
    </div>
  );
}
