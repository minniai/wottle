"use client";

import { bandMap, mapLetters } from "@/lib/pages/bandMap";
import type { Band } from "@/lib/types/standing";

const LINES = Array.from({ length: 9 }, (_, i) => (i + 1) * 10);

interface BandMapProps {
  bands: Band[];
  /** The board as the match ended; without it the map is bands alone. */
  board: string[][] | null;
  label: string;
}

/**
 * The last match as it ended (game flow B1, amended 2026-09-25): the final
 * field in the field's own terms. Rules, bands and chevrons in seat colour,
 * each scored letter in the colour of the player who froze it first, every
 * other letter muted, inside a hairline edge.
 */
export function BandMap({ bands, board, label }: BandMapProps) {
  const letters = mapLetters(board, bands);
  return (
    <svg className="band-map" viewBox="0 0 100 100" role="img" aria-label={label} preserveAspectRatio="none">
      {LINES.map((v) => (
        <g key={v} className="band-map__rule">
          <line x1={v} y1={0} x2={v} y2={100} />
          <line x1={0} y1={v} x2={100} y2={v} />
        </g>
      ))}
      {bandMap(bands).map((b, i) => (
        <g key={i}>
          <rect x={b.rect.x} y={b.rect.y} width={b.rect.w} height={b.rect.h} className={`mark-band mark-band--${b.seat}`} />
          <path d={b.chevron} className={`mark-chevron mark-chevron--${b.seat} band-map__chevron`} />
        </g>
      ))}
      {letters.map((l) => (
        <text
          key={`${l.x},${l.y}`}
          x={l.x * 10 + 5}
          y={l.y * 10 + 5}
          className={`band-map__letter${l.seat ? ` band-map__letter--${l.seat}` : ""}`}
        >
          {l.letter}
        </text>
      ))}
      {letters.length > 0 ? <rect x={0} y={0} width={100} height={100} className="band-map__frame" /> : null}
    </svg>
  );
}
