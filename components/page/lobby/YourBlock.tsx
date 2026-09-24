"use client";

import type { ReactNode } from "react";

import { useCopy, useLocale } from "@/components/i18n/LocaleProvider";

export interface LobbyViewer {
  displayName: string;
  handle: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Your block (game flow B1): a bar at 40px — the square, your name as the page's h1, your standing here; the page primary at the right. */
export function YourBlock({ viewer, primary, below }: { viewer: LobbyViewer; primary: ReactNode; below: ReactNode }) {
  const copy = useCopy();
  const locale = useLocale();
  const languageName = locale.id === "is" ? copy.pages.LANGUAGE_NAME_IS : copy.pages.LANGUAGE_NAME_EN;
  const record = `${viewer.wins}–${viewer.losses}–${viewer.draws}`;
  const lines = viewer.gamesPlayed > 0 ? copy.pages.blockSubLines(viewer.rating, languageName, viewer.gamesPlayed, record) : [copy.pages.blockSubNew(viewer.rating, languageName)];
  return (
    <div className="lobby-block">
      <div className="lobby-block__who">
        <h1 className="lobby-block__name">
          <span className="page-square page-square--you page-square--16" aria-hidden="true" />
          {viewer.displayName}
        </h1>
        {/* One line on desktop; on a phone the record takes a second line (F2). */}
        <p className="page-label lobby-block__sub">
          {lines.map((line, i) => (
            <span key={line} className="lobby-block__sub-line">
              {i > 0 ? <span className="lobby-block__sep"> · </span> : null}
              {line}
            </span>
          ))}
        </p>
      </div>
      <div className="lobby-block__primary">
        {primary}
        {below}
      </div>
    </div>
  );
}
