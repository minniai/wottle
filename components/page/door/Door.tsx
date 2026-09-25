"use client";

import { useState, type ReactNode } from "react";

import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";
import type { ReturningPlayer } from "@/lib/types/lobby";

import { Strip } from "../Strip";
import { NameForm, ReturningForm } from "./DoorForm";
import { HereNowList, type DoorHereRow } from "./HereNowList";
import { HowItPlays } from "./HowItPlays";

const STRIP_CELL_PX = 40;
const PHONE_STRIP_CELL_PX = 28;

interface DoorProps {
  here: DoorHereRow[];
  more: number;
  returning: ReturningPlayer | null;
  next: string | null;
  /** Spec 072: the invite door puts its invitation in place of the name form. */
  entry?: ReactNode;
}

/**
 * The door (spec 070 US1, game flow A1 and F1): the strip, a welcome and
 * one field to enter; who is here and how it plays. No field on the page.
 */
export function Door({ here, more, returning, next, entry }: DoorProps) {
  const copy = useCopy();
  const locale = useLocale();
  const [anotherName, setAnotherName] = useState(false);
  const isPhone = useIsPhone();
  return (
    <div className="page-columns door">
      <div className="page-col-a door__promise">
        <div className="door__strip">
          <Strip locale={locale.id} cellPx={isPhone ? PHONE_STRIP_CELL_PX : STRIP_CELL_PX} />
        </div>
        <h1 className="door__headline">{copy.pages.WELCOME}</h1>
        <p className="page-lede door__lede">{copy.pages.TAGLINE}</p>
      </div>
      <div className="page-col-b door__entry">
        {entry ?? (returning && !anotherName ? <ReturningForm returning={returning} next={next} onAnotherName={() => setAnotherName(true)} /> : <NameForm next={next} />)}
        <HereNowList here={here} more={more} />
        <HowItPlays />
      </div>
    </div>
  );
}
