"use client";

import { useEffect, useState } from "react";

import { chevronPath, lockup, type MarkLocale } from "@/lib/brand/lockup";

const ARRIVED_KEY = "wottle.lockupArrived";

/** The arrival plays once per session (§6); storage may be missing, so every read and write is guarded. */
function useArrivalOnce(): boolean {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ARRIVED_KEY)) return;
      window.sessionStorage.setItem(ARRIVED_KEY, "1");
      setAnimate(true);
    } catch {
      // No storage: show the end state.
    }
  }, []);
  return animate;
}

/**
 * The lockup (game flow §6): two names crossing on the game's own cells, the
 * visitor's language across in `--you`, the other down in `--opp`. A pure
 * image. On a session's first door the primary letters land, its band draws,
 * then the guest's (about 1.45s); under reduced motion only the end state.
 */
export function Lockup({ locale, cellPx, label }: { locale: MarkLocale; cellPx: number; label: string }) {
  const l = lockup(locale, cellPx);
  const animate = useArrivalOnce();
  const primaryCount = l.cells.filter((c) => c.seat === "you").length;
  return (
    <div className={`mark-lockup${animate ? " mark-lockup--arrive" : ""}`} role="img" aria-label={label} style={{ width: l.width, height: l.height }} data-testid="lockup">
      {l.cells.map((c) => (
        <span key={`r${c.col}-${c.row}`} className="mark-rule" aria-hidden="true" style={{ left: c.col * cellPx, top: c.row * cellPx, width: cellPx + 1, height: cellPx + 1 }} />
      ))}
      <svg className="mark-lockup__art" aria-hidden="true" width={l.width} height={l.height} viewBox={`0 0 ${l.width} ${l.height}`}>
        {l.bands.map((b) => (
          <g key={b.seat} className={`mark-band-group mark-band-group--${b.seat}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} className={`mark-band mark-band--${b.seat}`} />
            <path d={chevronPath(b, cellPx)} className={`mark-chevron mark-chevron--${b.seat}`} />
          </g>
        ))}
      </svg>
      {l.cells.map((c, i) => {
        const tone = c.seat === "you" ? "you" : l.oppTone;
        const order = c.seat === "you" ? i : i - primaryCount;
        return (
          <span
            key={`${c.col}-${c.row}`}
            aria-hidden="true"
            className={`mark-cell mark-cell--bare mark-cell--${tone} mark-letter--${c.seat}`}
            style={{ left: c.col * cellPx, top: c.row * cellPx, width: cellPx, height: cellPx, fontSize: l.letterPx, ["--land-order" as string]: order }}
          >
            {c.letter}
            {l.showNumerals ? <span className="mark-numeral" style={{ fontSize: l.numeralPx }}>{c.value}</span> : null}
          </span>
        );
      })}
    </div>
  );
}
