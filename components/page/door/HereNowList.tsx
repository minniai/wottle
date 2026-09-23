"use client";

import { useCopy } from "@/components/i18n/LocaleProvider";

export interface DoorHereRow {
  displayName: string;
  rating: number;
  state: "here" | "searching";
}

/**
 * Who is here now, on the door (A1, owner decision §10 Q3; spec 070 Q2): at
 * most eight names with rating and presence word, then a plain count. The
 * names are not links: a visitor enters the lobby to challenge someone.
 */
export function HereNowList({ here, more }: { here: DoorHereRow[]; more: number }) {
  const copy = useCopy();
  return (
    <section className="door-here" aria-labelledby="door-here-label">
      <h2 id="door-here-label" className="page-caption">{copy.pages.hereNow(here.length + more)}</h2>
      {here.length === 0 ? (
        <p className="page-sentence">{copy.pages.NO_ONE_YET}</p>
      ) : (
        <ul className="door-here__rows">
          {here.map((row) => (
            <li key={row.displayName} className="door-here__row" data-testid="door-here-row">
              <span className="door-here__name">{row.displayName}</span>
              <span className="door-here__facts">
                <span className="door-here__rating">{row.rating}</span>
                <span className="page-label">{row.state === "searching" ? copy.pages.SEARCHING : copy.pages.HERE}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? <p className="page-label door-here__more">{copy.pages.more(more)}</p> : null}
      {here.length > 0 ? <p className="page-label">{copy.pages.ENTER_TO_CHALLENGE}</p> : null}
    </section>
  );
}
