"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

import Link from "next/link";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import {
  FORM_RUN_MAX,
  formCellLabel,
  formResultWord,
  formRun,
  formRunSlots,
  formTipAnchor,
} from "@/lib/pages/formRun";
import type { FormGame } from "@/lib/types/standing";

import { whenWord } from "./when";

/** As many cells as the strip's width holds; the most kept until it is measured. */
function useFitSlots(ref: RefObject<HTMLElement | null>): number {
  const [slots, setSlots] = useState(FORM_RUN_MAX);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (el.clientWidth > 0) setSlots(formRunSlots(el.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return slots;
}

const noSubscribe = () => () => {};

/** False while hydrating: "yesterday" depends on the time zone, which the server does not share with the browser. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

interface TipProps {
  game: FormGame;
  when: string;
  index: number;
  slots: number;
}

/** The card under a cell: who, the score (yours in your colour), when and the result. Never takes the pointer. */
function FormTip({ game, when, index, slots }: TipProps) {
  const copy = useCopy();
  const anchor = formTipAnchor(index, slots);
  const offset =
    anchor === "start" ? { left: index * 19 } : { right: (slots - 1 - index) * 19 };
  return (
    <div className="form-run__tip" data-anchor={anchor} style={offset} aria-hidden="true">
      <span className="form-run__tip-head">
        <span className="form-run__tip-name">{game.opponent}</span>
        <span className="form-run__tip-score">
          <span className="seat-you">{game.you}</span>–
          <span className="seat-opp-text">{game.them}</span>
        </span>
      </span>
      <span className="page-label form-run__tip-foot">
        <span>{`${when} · ${formResultWord(game, copy)}`}</span>
        <span className="form-run__tip-review">{copy.pages.REVIEW}</span>
      </span>
    </div>
  );
}

/**
 * The lobby's form strip (2026-09-26): as many of your last matches as fit
 * column A, oldest first. Each cell is a link to that match's review; hover or
 * focus opens a card with the opponent, the score and the date.
 */
export function FormRun({ games, nowMs }: { games: FormGame[]; nowMs: number }) {
  const copy = useCopy();
  const to = useLocalePath();
  const trackRef = useRef<HTMLDivElement>(null);
  const slots = useFitSlots(trackRef);
  const [active, setActive] = useState<number | null>(null);
  const run = formRun(games, slots, copy);
  const hydrated = useHydrated();
  const when = (game: FormGame) =>
    hydrated ? whenWord(game.completedAt, nowMs, copy) : null;
  const activeGame = active === null ? null : run.cells[active]?.game;
  return (
    <div className="form-strip form-run">
      <span className="page-caption form-strip__label" aria-hidden="true">
        {run.caption}
      </span>
      <div ref={trackRef} className="form-run__track">
        <ol className="form-strip__cells form-run__cells" aria-label={run.label}>
          {run.cells.map((cell, i) => (
            <li key={cell.game?.matchId ?? `empty-${i}`} className="form-run__slot">
              {cell.game ? (
                <Link
                  href={to(`/match/${cell.game.matchId}?review=last`)}
                  className="form-strip__cell form-run__cell"
                  data-result={cell.result}
                  data-active={active === i || undefined}
                  aria-label={formCellLabel(cell.game, when(cell.game), copy)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onKeyDown={(e) => e.key === "Escape" && setActive(null)}
                >
                  {cell.letter}
                </Link>
              ) : (
                <span
                  className="form-strip__cell"
                  data-result="none"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
        {activeGame && active !== null ? (
          <FormTip
            game={activeGame}
            when={when(activeGame) ?? ""}
            index={active}
            slots={slots}
          />
        ) : null}
      </div>
    </div>
  );
}
