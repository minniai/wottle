"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";
import type { Overview } from "@/lib/types/standing";
import type { ReturningPlayer } from "@/lib/types/lobby";

import { PageFrame } from "../PageFrame";
import { Door } from "./Door";

interface DoorPageProps {
  overview: Overview;
  returning: ReturningPlayer | null;
  next: string | null;
  preferOther: boolean;
}

/** `/` signed out (spec 070 US1): the door in its page frame, with the masthead's here-now count (S10). */
export function DoorPage({ overview, returning, next, preferOther }: DoorPageProps) {
  const copy = useCopy();
  const here = overview.counts.here;
  const doorCount = here > 0 ? copy.pages.doorCount(here, overview.counts.matchesOn) : null;
  return (
    <PageFrame variant="door" place={null} doorCount={doorCount} doorCountPhone={here > 0 ? copy.pages.doorCountPhone(here) : null} preferOther={preferOther}>
      <Door here={overview.here ?? []} more={overview.more ?? 0} returning={returning} next={next} />
    </PageFrame>
  );
}
