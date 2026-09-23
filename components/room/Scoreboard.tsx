"use client";

import type { CSSProperties } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { getSeatColors, type Seat } from "@/lib/constants/seatColors";
import { TICKS_PER_BLOCK } from "@/lib/room/clock";
import type { ClockRow, PlayerRow, ScoreboardView } from "@/lib/room/scoreboard";

interface ScoreboardProps {
  view: ScoreboardView;
  /** The totals as drawn, e.g. while counting up; the view's totals otherwise. */
  totals?: Record<Seat, number>;
  profiles?: Partial<Record<Seat, string>>;
  /** While the match is live a profile opens in a new tab, so the match keeps running. */
  profileInNewTab?: boolean;
  /** The phone's scoreboard: the blocks fill in 5s steps with no tick marks (spec 068 FR-009). */
  compact?: boolean;
}

function Block({ ticks, compact }: { ticks: number; compact: boolean }) {
  if (compact) {
    return <span className="scoreboard__block" data-block style={{ "--fill": String(ticks / TICKS_PER_BLOCK) } as CSSProperties} />;
  }
  return (
    <span className="scoreboard__block" data-block>
      {Array.from({ length: TICKS_PER_BLOCK }, (_, i) => (
        <span key={i} className="scoreboard__tick" data-tick={i < ticks ? "on" : "off"} />
      ))}
    </span>
  );
}

function ClockLine({ clock, compact }: { clock: ClockRow; compact: boolean }) {
  const { clockAria } = useCopy();
  return (
    <div className="scoreboard__row scoreboard__row--clock" data-testid="scoreboard-clock" role="timer" aria-live="off" aria-label={clockAria(clock.detail ? `${clock.label}, ${clock.detail}` : clock.label, clock.numeral)} data-phase={clock.phase}>
      <span className="scoreboard__text">
        <span className="scoreboard__label">{clock.label}</span>
        {clock.detail ? <span className="scoreboard__detail">{clock.detail}</span> : null}
      </span>
      <span className="scoreboard__track" data-testid="scoreboard-clock-track" aria-hidden="true">
        {clock.blocks.map((ticks, k) => (
          <Block key={k} ticks={ticks} compact={compact} />
        ))}
      </span>
      <span className="scoreboard__numeral">{clock.numeral}</span>
    </div>
  );
}

function PlayerName({ row, href, newTab }: { row: PlayerRow; href?: string; newTab: boolean }) {
  const { profileOpensInNewTab } = useCopy();
  if (!href) return <span className="scoreboard__name" data-testid="scoreboard-name">{row.name}</span>;
  return (
    <a
      className="scoreboard__name scoreboard__name--link"
      data-testid="scoreboard-name"
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      aria-label={newTab ? profileOpensInNewTab(row.name) : undefined}
    >
      {row.name}
    </a>
  );
}

function PlayerLine({ row, total, href, newTab, limit }: { row: PlayerRow; total: number; href?: string; newTab: boolean; limit: number }) {
  const { points, movesLeft, YOUR_MOVES, OPPONENT_MOVES } = useCopy();
  const style = { "--seat-ink": getSeatColors(row.seat).ink, "--seat-text": getSeatColors(row.seat).text } as CSSProperties;
  return (
    <div className="scoreboard__row scoreboard__row--player" data-testid={`scoreboard-row-${row.seat}`} data-seat={row.seat} style={style}>
      <div className="scoreboard__who">
        <span className="scoreboard__seat" aria-hidden="true" />
        <span className="scoreboard__text">
          <PlayerName row={row} href={href} newTab={newTab} />
          <span className="scoreboard__subline" data-testid="scoreboard-subline">
            {row.muted}
            {row.suffix ? (
              <span className="scoreboard__suffix" data-testid="scoreboard-turn" data-tone={row.tone}>
                {row.muted ? " · " : null}
                {row.suffix}
              </span>
            ) : null}
          </span>
        </span>
      </div>
      <span
        className="scoreboard__track scoreboard__track--moves"
        data-testid="scoreboard-track"
        data-mode={row.laneMode}
        role="progressbar"
        aria-label={row.seat === "you" ? YOUR_MOVES : OPPONENT_MOVES}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={row.movesLeft}
        aria-valuetext={movesLeft(row.movesLeft, limit)}
      >
        {row.segments.map((state, i) => (
          <span key={i} className="scoreboard__segment" data-state={state} />
        ))}
      </span>
      {/* Before a match starts there is no total; the column keeps its place (spec 069). */}
      <span className="scoreboard__total" data-testid="scoreboard-total">
        {row.showTotal ? points(total) : ""}
      </span>
    </div>
  );
}

/**
 * The match's clock and both players in one box above the field (spec 068,
 * design system §5.3): the clock, then the opponent, then you, nearest the
 * board you play on. Urgency is weight only; nothing here animates.
 */
export function Scoreboard({ view, totals, profiles = {}, profileInNewTab = false, compact = false }: ScoreboardProps) {
  const { SCOREBOARD } = useCopy();
  const limit = view.you.segments.length;
  return (
    <section className="scoreboard" data-testid="scoreboard" data-compact={compact ? "true" : undefined} aria-label={SCOREBOARD}>
      <ClockLine clock={view.clock} compact={compact} />
      <PlayerLine row={view.opp} total={totals?.opp ?? view.opp.total} href={profiles.opp} newTab={profileInNewTab} limit={limit} />
      <PlayerLine row={view.you} total={totals?.you ?? view.you.total} href={profiles.you} newTab={profileInNewTab} limit={limit} />
    </section>
  );
}
