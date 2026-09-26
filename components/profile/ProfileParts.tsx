"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { whenWord } from "@/components/page/lobby/when";
import type { Seat } from "@/lib/constants/seatColors";
import { profileHeader } from "@/lib/profile/profileHeader";
import { recordCells } from "@/lib/profile/record";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { ProfileView, ProfileWord } from "@/lib/types/profile";

import { ProfileChart } from "./ProfileChart";

/**
 * The parts of a profile (spec 072 E1, E2, F9), shared by your own and
 * another player's. The owner's seat colour carries through the name, the
 * rating, the chart, the form strip's wins and the best words.
 */
export function languageNameOf(language: string, copy: ReturnType<typeof useCopy>): string {
  return language === "is" ? copy.pages.LANGUAGE_NAME_IS : copy.pages.LANGUAGE_NAME_EN;
}

export function ProfileHeader({ view, seat, presence }: { view: ProfileView; seat: Seat; presence?: ReactNode }) {
  const copy = useCopy();
  const sub = profileHeader(view, copy, languageNameOf(view.language, copy));
  return (
    <header className="profile-head" data-testid="profile-head">
      <div className="profile-head__name-row">
        <h1 className="profile-head__name">
          <span className={`page-square page-square--16 page-square--${seat}`} aria-hidden="true" />
          {view.displayName}
        </h1>
        <span className={`profile-head__rating seat-${seat}`} data-testid="profile-rating">{view.rating}</span>
      </div>
      <p className="profile-head__sub">
        <span className="profile-head__handle" data-testid="profile-sub-left">{sub.subLeft}</span>
        <span className="page-label" data-testid="profile-sub-right">{sub.subRight}</span>
      </p>
      {presence}
    </header>
  );
}

export function RecordRow({ view }: { view: ProfileView }) {
  const copy = useCopy();
  return (
    <div className="profile-record" role="table" aria-label={copy.RECORD} data-testid="profile-record">
      <div className="profile-record__row" role="row">
        {recordCells(view.record, copy).map((cell) => (
          <div key={cell.label} className="profile-record__cell" role="cell">
            <span className="profile-record__value">{cell.value}</span>
            <span className="page-label">{cell.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A best word on its cells: letters and values in the owner's colour, a 14% band and a chevron (the field's grammar). */
export function WordStrip({ word, seat }: { word: ProfileWord; seat: Seat }) {
  const copy = useCopy();
  return (
    <div className="word-strip" data-seat={seat} data-testid="word-strip">
      <div className="word-strip__cells" role="img" aria-label={copy.pages.wordStripAria(word.word, word.points)}>
        <svg className="word-strip__band" viewBox={`0 0 ${word.tiles.length * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
          <rect x="5" y="20" width={word.tiles.length * 100 - 10} height="60" className="word-strip__tint" />
          <path d="M 5 22 L 14 50 L 5 78" className="word-strip__chevron" vectorEffect="non-scaling-stroke" />
        </svg>
        {word.tiles.map((tile, i) => (
          <span key={i} className="word-strip__cell" aria-hidden="true">
            {tile.letter}
            <span className="word-strip__value">{tile.value}</span>
          </span>
        ))}
      </div>
      <span className="word-strip__points" aria-hidden="true">{word.points}</span>
    </div>
  );
}

export function BestWords({ view, seat }: { view: ProfileView; seat: Seat }) {
  const copy = useCopy();
  return (
    <section className="profile-words" aria-labelledby="profile-words-label">
      <h2 id="profile-words-label" className="page-caption page-caption--ink">{copy.BEST_WORDS}</h2>
      {view.bestWords.length === 0 ? (
        <p className="page-sentence">{copy.pages.FIRST_MATCH}</p>
      ) : (
        view.bestWords.map((word) => <WordStrip key={word.word} word={word} seat={seat} />)
      )}
    </section>
  );
}

/** Recent matches (yours) or your matches against this player (theirs): score, result and `review ▸`. */
export function ProfileMatches({ rows, caption, dated }: { rows: RecentGameRow[]; caption: string; dated: boolean }) {
  const copy = useCopy();
  const to = useLocalePath();
  const nowMs = Date.now();
  return (
    <section className="recent profile-matches" aria-labelledby="profile-matches-label" data-testid="profile-matches">
      <h2 id="profile-matches-label" className="page-caption page-caption--ink">{caption}</h2>
      {rows.length === 0 ? (
        <p className="page-sentence">{copy.pages.FIRST_MATCH}</p>
      ) : (
        <ul className="recent__rows">
          {rows.map((game) => (
            <li key={game.matchId} className="recent__row">
              <span className={dated ? "page-label" : "recent__name"}>{dated ? whenWord(game.completedAt, nowMs, copy) : game.opponentDisplayName}</span>
              <span className="recent__score">
                <span className="seat-you">{game.yourScore}</span>–<span className="seat-opp-text">{game.opponentScore}</span>
              </span>
              <span className="page-label">{copy.pages.RESULT_WORDS[game.result]}</span>
              <Link href={to(`/match/${game.matchId}?review=last`)} className="page-link page-link--ink">{copy.pages.REVIEW}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { ProfileChart };
