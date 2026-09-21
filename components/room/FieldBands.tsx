"use client";

import { getSeatColors } from "@/lib/constants/seatColors";
import type { CSSProperties } from "react";

import { chevronPath, computeBandRect, type ChevronEdge, type WordBand } from "@/lib/room/bandGeometry";

interface FieldBandsProps {
  bands: WordBand[];
  /** Ledger row under the pointer: other rounds dim to 6%. */
  highlightMove: number | null;
  /** Reveal: how many bands (in order) are drawn; null = all. */
  drawnCount?: number | null;
  /** Reveal: the band currently drawing (animates from its reading start). */
  drawingIndex?: number | null;
}

const ORIGIN: Record<ChevronEdge, string> = { left: "left center", right: "right center", top: "center top", bottom: "center bottom" };

function drawStyle(edge: ChevronEdge): CSSProperties {
  const horizontal = edge === "left" || edge === "right";
  return { transformOrigin: ORIGIN[edge], "--band-from-x": horizontal ? 0 : 1, "--band-from-y": horizontal ? 1 : 0 } as CSSProperties;
}

/**
 * One SVG under the cells: a rect + chevron per scored word (design system
 * §5.2). The tint covers the letters the word froze first; the chevron sits
 * at the whole word's reading start; a hovered round shows its whole words
 * (spec 049 US2).
 */
export function FieldBands({ bands, highlightMove, drawnCount = null, drawingIndex = null }: FieldBandsProps) {
  return (
    <svg className="field__bands" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden data-testid="field-bands">
      {bands.map((band, i) => {
        const lit = highlightMove !== null && band.move === highlightMove;
        const cells = lit ? band.wordCells : band.cells;
        const rect = computeBandRect(cells, band.direction);
        const chevron = chevronPath(computeBandRect(band.wordCells, band.direction));
        const colors = getSeatColors(band.seat);
        const dimmed = highlightMove !== null && !lit;
        const drawn = drawnCount === null || i < drawnCount;
        if (!drawn) return null;
        const drawing = drawingIndex === i;
        return (
          <g
            key={band.id}
            className={`field__band field__band--${band.strength}${dimmed ? " field__band--dimmed" : ""}${drawing ? " field__band--drawing" : ""}`}
            style={drawing ? drawStyle(rect.chevronEdge) : undefined}
            data-testid="field-band"
            data-seat={band.seat}
            data-direction={band.direction}
            data-move={band.move}
            data-word={band.word}
            data-cells={cells.map((c) => `${c.x},${c.y}`).join(";")}
          >
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={band.strength === "live" ? colors.live : colors.band} />
            <path d={chevron} fill="none" stroke={colors.ink} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
