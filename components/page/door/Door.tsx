"use client";

import { useState } from "react";

import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";
import { doorCopy } from "@/lib/pages/doorCopy";
import { MATCH_CLOCK_BUDGET_MS } from "@/lib/room/clock";
import { TOTAL_MOVES } from "@/lib/room/ledgerRows";
import type { ReturningPlayer } from "@/lib/types/lobby";

import { Lockup } from "../Lockup";
import { NameForm, ReturningForm } from "./DoorForm";
import { HereNowList, type DoorHereRow } from "./HereNowList";
import { HowItPlays } from "./HowItPlays";

const LOCKUP_CELL_PX = { is: 72, en: 64 } as const;
const PHONE_LOCKUP_CELL_PX = { is: 51, en: 47 } as const;

interface DoorProps {
  here: DoorHereRow[];
  more: number;
  returning: ReturningPlayer | null;
  next: string | null;
}

/**
 * The door (spec 070 US1, game flow A1 and F1): the lockup, the promise and
 * one field to enter; who is here and how it plays. No field on the page.
 */
export function Door({ here, more, returning, next }: DoorProps) {
  const copy = useCopy();
  const locale = useLocale();
  const [anotherName, setAnotherName] = useState(false);
  const isPhone = useIsPhone();
  const words = doorCopy(copy, { moveLimit: TOTAL_MOVES, clockMs: MATCH_CLOCK_BUDGET_MS, here: here.length + more, matchesOn: 0 });
  return (
    <div className="page-columns door">
      <div className="page-col-a door__promise">
        <div className="door__lockup">
          <Lockup locale={locale.id} cellPx={(isPhone ? PHONE_LOCKUP_CELL_PX : LOCKUP_CELL_PX)[locale.id]} label={copy.pages.LOCKUP_LABEL} />
        </div>
        <p className="page-label door__kicker">{words.kicker}</p>
        <h1 className="door__headline">
          <span className="door__headline--desktop">
            {words.headline[0]}
            <br />
            {words.headline[1]}
          </span>
          <span className="door__headline--phone">
            {words.headlinePhone.map((line, i) => (
              <span key={line} className="door__headline-line">
                {line}
                {i < words.headlinePhone.length - 1 ? <br /> : null}
              </span>
            ))}
          </span>
        </h1>
        <p className="page-lede door__lede">{words.lede}</p>
      </div>
      <div className="page-col-b door__entry">
        {returning && !anotherName ? (
          <ReturningForm returning={returning} next={next} onAnotherName={() => setAnotherName(true)} />
        ) : (
          <NameForm next={next} />
        )}
        <HereNowList here={here} more={more} />
        <HowItPlays />
      </div>
    </div>
  );
}
