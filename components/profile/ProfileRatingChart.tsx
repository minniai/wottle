import type { RatingHistoryEntry } from "@/lib/types/match";

interface ProfileRatingChartProps {
  history: RatingHistoryEntry[];
}

const VIEWBOX_W = 600;
const VIEWBOX_H = 220;
const PAD_X = 24;
const PAD_Y = 16;

export function ProfileRatingChart({ history }: ProfileRatingChartProps) {
  if (history.length === 0) {
    return (
      <div
        data-testid="profile-rating-chart"
        className="flex h-[220px] w-full items-center justify-center rounded-xl border border-hair bg-paper-2 text-sm text-ink-soft"
      >
        No rated matches yet.
      </div>
    );
  }

  const ratings = history.map((h) => h.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const range = max - min || 1;

  const xStep =
    history.length > 1 ? (VIEWBOX_W - PAD_X * 2) / (history.length - 1) : 0;

  const points = history.map((h, i) => {
    const x = PAD_X + i * xStep;
    const y =
      VIEWBOX_H - PAD_Y - ((h.rating - min) / range) * (VIEWBOX_H - PAD_Y * 2);
    return { x, y, rating: h.rating };
  });

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD =
    `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${VIEWBOX_H - PAD_Y} ` +
    `L ${points[0].x.toFixed(1)} ${VIEWBOX_H - PAD_Y} Z`;

  const gridYs = [0.2, 0.4, 0.6, 0.8].map(
    (t) => PAD_Y + t * (VIEWBOX_H - PAD_Y * 2),
  );

  const endpoint = points[points.length - 1];

  return (
    <svg
      data-testid="profile-rating-chart"
      role="img"
      aria-label="Rating history chart"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      className="h-[220px] w-full rounded-xl border border-hair bg-paper-2"
    >
      <defs>
        <linearGradient id="rating-chart-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ochre-deep)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--ochre-deep)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridYs.map((y) => (
        <line
          key={y}
          x1={PAD_X}
          x2={VIEWBOX_W - PAD_X}
          y1={y}
          y2={y}
          stroke="var(--hair)"
          strokeDasharray="3 4"
        />
      ))}
      <path d={areaD} fill="url(#rating-chart-grad)" />
      <path
        d={lineD}
        fill="none"
        stroke="var(--ochre-deep)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={endpoint.x} cy={endpoint.y} r={5} fill="var(--ochre-deep)" />
    </svg>
  );
}
