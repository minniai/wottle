"use client";

import Link from "next/link";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import type { RecentGameRow } from "@/lib/types/lobby";

const SHOWN = 4;

/** Your last matches (game flow B1): four rows of name, score (yours in your colour), result and review. Never a void or abandoned match. */
export function RecentMatches({ recent }: { recent: RecentGameRow[] }) {
  const copy = useCopy();
  const to = useLocalePath();
  if (recent.length === 0) return null;
  return (
    <section className="recent" aria-labelledby="recent-label">
      <h2 id="recent-label" className="page-caption">{copy.YOUR_LAST_MATCHES}</h2>
      <ul className="recent__rows">
        {recent.slice(0, SHOWN).map((game) => (
          <li key={game.matchId} className="recent__row">
            <span className="recent__name">{game.opponentDisplayName}</span>
            <span className="recent__score">
              <span className="seat-you">{game.yourScore}</span>–<span className="seat-opp-text">{game.opponentScore}</span>
            </span>
            <span className="page-label">{copy.pages.RESULT_WORDS[game.result]}</span>
            <Link href={to(`/match/${game.matchId}?review=last`)} className="page-link page-link--ink">{copy.pages.REVIEW}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
