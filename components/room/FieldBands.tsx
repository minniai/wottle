"use client";

import { getSeatColors } from "@/lib/constants/seatColors";
import { chevronPath, computeBandRect, type WordBand } from "@/lib/room/bandGeometry";

interface FieldBandsProps {
  bands: WordBand[];
  /** Ledger row under the pointer: other rounds dim to 6%. */
  highlightRound: number | null;
  /** Reveal: how many bands (in order) are drawn; null = all. */
  drawnCount?: number | null;
}

/** One SVG under the cells: a rect + chevron per scored word (design system §5.2). */
export function FieldBands({ bands, highlightRound, drawnCount = null }: FieldBandsProps) {
  return (
    <svg className="field__bands" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden data-testid="field-bands">
      {bands.map((band, i) => {
        const rect = computeBandRect(band.cells, band.direction);
        const colors = getSeatColors(band.seat);
        const dimmed = highlightRound !== null && band.round !== highlightRound;
        const drawn = drawnCount === null || i < drawnCount;
        if (!drawn) return null;
        return (
          <g
            key={band.id}
            className={`field__band field__band--${band.strength}${dimmed ? " field__band--dimmed" : ""}`}
            data-testid="field-band"
            data-seat={band.seat}
            data-direction={band.direction}
            data-round={band.round}
            data-word={band.word}
          >
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={band.strength === "live" ? colors.live : colors.band} />
            <path d={chevronPath(rect)} fill="none" stroke={colors.ink} strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
