import type { Copy } from "@/lib/i18n/copy/types";

export interface DoorFacts {
  moveLimit: number;
  clockMs: number;
  here: number;
  matchesOn: number;
}

export interface DoorCopy {
  kicker: string;
  headline: [string, string];
  headlinePhone: [string, string, string];
  lede: string;
  /** The masthead's here-now count, hidden when nobody is here (A1). */
  count: string | null;
}

const MS_PER_MINUTE = 60_000;

/** The door's words (spec 070 US1.2, FR-008): the promise is built from the configuration, never from literals. */
export function doorCopy(copy: Copy, facts: DoorFacts): DoorCopy {
  const minutes = Math.round(facts.clockMs / MS_PER_MINUTE);
  return {
    kicker: copy.pages.KICKER,
    headline: copy.pages.headline(facts.moveLimit),
    headlinePhone: copy.pages.headlinePhone(facts.moveLimit),
    lede: copy.pages.lede(minutes),
    count: facts.here > 0 ? copy.pages.doorCount(facts.here, facts.matchesOn) : null,
  };
}
