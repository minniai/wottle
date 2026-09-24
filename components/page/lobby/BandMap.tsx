"use client";

import { bandMap } from "@/lib/pages/bandMap";
import type { Band } from "@/lib/types/standing";

const LINES = Array.from({ length: 9 }, (_, i) => (i + 1) * 10);

/** The band map (game flow B1, §8 item 7): a 10×10 grid of rules with the last match's bands, no frame, no letters. */
export function BandMap({ bands, label }: { bands: Band[]; label: string }) {
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
    </svg>
  );
}
