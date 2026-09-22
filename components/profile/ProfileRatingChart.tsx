"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { useEffect, useRef, useState } from "react";

import type { Seat } from "@/lib/constants/seatColors";
import { getSeatColors } from "@/lib/constants/seatColors";
import type { RatingHistoryEntry } from "@/lib/types/match";

interface ProfileRatingChartProps {
  history: RatingHistoryEntry[];
  seat: Seat;
}

/** Fallback coordinate width until the container is measured. */
const W = 600;
const H = 180;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_Y = 14;

/**
 * Hairline 30-day rating chart (design system §5.8): one 1.5px polyline in the
 * seat colour over three rule gridlines, ink axes left and bottom, mono labels.
 * No area fill, no markers, no tooltip.
 */
export function ProfileRatingChart({ history, seat }: ProfileRatingChartProps) {
  const { NO_RATED_MATCHES, ratingChartAria } = useCopy();
  // The coordinate system matches the rendered box, so one user unit is one
  // pixel and nothing the SVG draws is stretched — least of all the mono axis
  // labels (spec 045 B9).
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(W);
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth(Math.max(1, el.clientWidth || W));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ratings = history.map((h) => h.rating);
  const min = ratings.length ? Math.min(...ratings) : 0;
  const max = ratings.length ? Math.max(...ratings) : 0;
  const range = max - min || 1;
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_Y * 2;
  const xAt = (i: number) =>
    history.length > 1
      ? PAD_LEFT + (i * innerW) / (history.length - 1)
      : PAD_LEFT + innerW / 2;
  const yAt = (r: number) => H - PAD_Y - ((r - min) / range) * innerH;
  const points = history
    .map((h, i) => `${xAt(i).toFixed(1)},${yAt(h.rating).toFixed(1)}`)
    .join(" ");
  const gridYs = [0.25, 0.5, 0.75].map((t) => PAD_Y + t * innerH);
  const color = getSeatColors(seat).ink;

  return (
    <div ref={frameRef} className="profile-chart__frame">
      <svg
        data-testid="profile-rating-chart"
        role="img"
        aria-label={
          history.length ? ratingChartAria(min, max) : NO_RATED_MATCHES
        }
        viewBox={`0 0 ${width} ${H}`}
        preserveAspectRatio="xMinYMin meet"
        className="profile-chart"
      >
        {gridYs.map((y) => (
          <line
            key={y}
            x1={PAD_LEFT}
            x2={width - PAD_RIGHT}
            y1={y}
            y2={y}
            stroke="var(--rule)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT}
          y1={PAD_Y}
          y2={H - PAD_Y}
          stroke="var(--ink)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={PAD_LEFT}
          x2={width - PAD_RIGHT}
          y1={H - PAD_Y}
          y2={H - PAD_Y}
          stroke="var(--ink)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {history.length > 0 ? (
          <>
            <text
              x={PAD_LEFT - 6}
              y={PAD_Y + 4}
              textAnchor="end"
              className="profile-chart__label"
            >
              {max}
            </text>
            <text
              x={PAD_LEFT - 6}
              y={H - PAD_Y}
              textAnchor="end"
              className="profile-chart__label"
            >
              {min}
            </text>
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              data-testid="profile-rating-line"
            />
          </>
        ) : (
          <text
            x={PAD_LEFT + innerW / 2}
            y={H / 2}
            textAnchor="middle"
            className="profile-chart__label"
          >
            {NO_RATED_MATCHES}
          </text>
        )}
      </svg>
    </div>
  );
}
