"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { Seat } from "@/lib/constants/seatColors";
import type { ChartPoint } from "@/lib/types/profile";

interface ChartBox {
  width: number;
  height: number;
}

const DESKTOP: ChartBox = { width: 708, height: 200 };
const PHONE: ChartBox = { width: 358, height: 140 };
const LEFT = 48;
const RIGHT = 8;
const TOP = 6;
const BOTTOM = 28;
const STEP = 10;

/** Three rules: the range padded to tens, and its middle. */
function ticksOf(points: ChartPoint[]): [number, number, number] {
  const values = points.map((p) => p.rating);
  const lo = Math.floor((Math.min(...values) - STEP) / STEP) * STEP;
  const hi = Math.ceil((Math.max(...values) + STEP) / STEP) * STEP;
  return [hi, Math.round((hi + lo) / 2), lo];
}

function Plot({ points, empty, box, seat }: { points: ChartPoint[]; empty: boolean; box: ChartBox; seat: Seat }) {
  const copy = useCopy();
  const [hi, mid, lo] = ticksOf(points);
  const t0 = Date.parse(points[0].at);
  const t1 = Date.parse(points[points.length - 1].at);
  const plotW = box.width - LEFT - RIGHT;
  const plotH = box.height - TOP - BOTTOM;
  const x = (at: string) => LEFT + ((Date.parse(at) - t0) / Math.max(1, t1 - t0)) * plotW;
  const y = (rating: number) => TOP + ((hi - rating) / Math.max(1, hi - lo)) * plotH;
  const base = TOP + plotH;
  return (
    <svg className="profile-chart__svg" width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} aria-hidden="true">
      {[hi, mid, lo].map((tick) => (
        <g key={tick}>
          <line x1={LEFT} x2={box.width - RIGHT} y1={y(tick)} y2={y(tick)} className="profile-chart__rule" />
          <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end" className="profile-chart__tick">{tick}</text>
        </g>
      ))}
      <line x1={LEFT} x2={LEFT} y1={0} y2={base} className="profile-chart__axis" />
      <line x1={LEFT} x2={box.width - RIGHT} y1={base} y2={base} className="profile-chart__axis" />
      <polyline points={points.map((p) => `${x(p.at).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ")} className={`profile-chart__line seat-stroke-${seat}`} />
      {empty ? (
        <text x={LEFT + 8} y={y(points[0].rating) - 8} className="profile-chart__tick">{copy.pages.chartEmpty(points[0].rating)}</text>
      ) : null}
      <text x={LEFT} y={box.height - 6} className="profile-chart__tick profile-chart__edge">{copy.pages.CHART_START}</text>
      <text x={box.width - RIGHT} y={box.height - 6} textAnchor="end" className="profile-chart__tick profile-chart__edge">{copy.pages.CHART_END}</text>
    </svg>
  );
}

/**
 * The rating over the last 30 days (spec 072 FR-031; design system §5.8): one
 * 1.5px line in the owner's colour over three rules, the axes in ink. With no
 * match in the window, a flat line at the rating, labelled.
 */
export function ProfileChart({ points, empty, seat }: { points: ChartPoint[]; empty: boolean; seat: Seat }) {
  const copy = useCopy();
  const values = points.map((p) => p.rating);
  return (
    <figure className="profile-chart" role="img" aria-label={copy.ratingChartAria(Math.min(...values), Math.max(...values))} data-testid="profile-chart">
      <span className="profile-chart__desktop"><Plot points={points} empty={empty} box={DESKTOP} seat={seat} /></span>
      <span className="profile-chart__phone"><Plot points={points} empty={empty} box={PHONE} seat={seat} /></span>
    </figure>
  );
}
