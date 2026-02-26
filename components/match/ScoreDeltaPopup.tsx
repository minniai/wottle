"use client";

import { useEffect, useState } from "react";

export interface ScoreDelta {
  letterPoints: number;
  lengthBonus: number;
  combo: number;
}

interface ScoreDeltaPopupProps {
  delta: ScoreDelta;
}

export function ScoreDeltaPopup({ delta }: ScoreDeltaPopupProps) {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMounted(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const parts: string[] = [];
  if (delta.letterPoints > 0) parts.push(`+${delta.letterPoints} letters`);
  if (delta.lengthBonus > 0) parts.push(`+${delta.lengthBonus} length`);
  if (delta.combo > 0) parts.push(`+${delta.combo} combo`);

  if (!mounted || parts.length === 0) return null;

  return (
    <span
      className="score-delta-popup"
      data-testid="score-delta-popup"
      aria-live="polite"
    >
      {parts.join(", ")}
    </span>
  );
}
