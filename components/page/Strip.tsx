import { chevronPath, strip, type MarkLocale } from "@/lib/brand/lockup";

/**
 * The strip logotype (game flow §6): the locale's name as one word on ruled
 * cells, ink letters, a tint band and an ink chevron. The house is not a seat,
 * so no seat colour. Pages only; field states keep the text wordmark.
 */
export function Strip({ locale, cellPx }: { locale: MarkLocale; cellPx: number }) {
  const s = strip(locale, cellPx);
  return (
    <span className="mark-strip" style={{ width: s.width, height: s.height }} aria-hidden="true">
      <svg className="mark-strip__art" width={s.width} height={s.height} viewBox={`0 0 ${s.width} ${s.height}`}>
        <rect x={s.band.x} y={s.band.y} width={s.band.w} height={s.band.h} className="mark-band mark-band--house" />
        <path d={chevronPath(s.band, cellPx)} className="mark-chevron mark-chevron--house" />
      </svg>
      {s.letters.map((c) => (
        <span
          key={c.col}
          className="mark-cell mark-cell--house"
          style={{ left: c.col * cellPx, top: 0, width: cellPx + 1, height: cellPx + 1, fontSize: s.letterPx }}
        >
          {c.letter}
          {s.showNumerals ? <span className="mark-numeral" style={{ fontSize: s.numeralPx }}>{c.value}</span> : null}
        </span>
      ))}
    </span>
  );
}
