"use client";

import { useState } from "react";

import Link from "next/link";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { RulesFigure } from "@/components/rules/RulesFigure";
import "@/app/styles/rules.css";
import { orderRows } from "@/lib/pages/lobbyRows";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { LobbyRow, Overview } from "@/lib/types/standing";

import { FormStrip } from "./FormStrip";
import { HereNowTable } from "./HereNowTable";
import { LastMatch } from "./LastMatch";
import { RecentMatches } from "./RecentMatches";
import { YourBlock, type LobbyViewer } from "./YourBlock";

export interface LobbyProps {
  viewer: LobbyViewer;
  rows: LobbyRow[];
  overview: Overview;
  recent: RecentGameRow[];
  onFind: () => void;
  onChallenge: (playerId: string) => void;
}

/** A new player's last-match slot (B1): the rules' swap figure, the line, and the rules. */
function FirstMatch() {
  const copy = useCopy();
  const to = useLocalePath();
  return (
    <section className="last-match last-match--first">
      <h2 className="page-caption">{copy.pages.LAST_MATCH}</h2>
      <RulesFigure kind="swap" caption={copy.pages.STEPS[0]} />
      <p className="page-sentence">{copy.pages.FIRST_MATCH}</p>
      <Link href={to("/rules")} className="page-link page-link--ink">{copy.HOW_TO_PLAY}</Link>
    </section>
  );
}

/**
 * The lobby (spec 070 US2, game flow B1): your block and form, who is here,
 * your last match and your last matches. No field and no hint.
 */
export function Lobby({ viewer, rows, overview, recent, onFind, onChallenge }: LobbyProps) {
  const copy = useCopy();
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const [nowMs] = useState(() => Date.now());
  const ordered = orderRows(rows, viewer.rating, frozen);
  const freeze = (on: boolean) => setFrozen(on ? ordered.map((r) => r.playerId) : null);
  const empty = rows.length === 0;
  const primary = (
    <button type="button" className="action-primary page-primary" onClick={onFind} data-testid="lobby-find">
      {copy.FIND_OPPONENT}
    </button>
  );
  const below = <p className="page-label lobby-block__note">{empty ? copy.pages.PAIRED_ON_ARRIVAL : copy.pages.searchingNow(overview.counts.searching)}</p>;
  return (
    <div className="page-columns lobby">
      <div className="page-col-a">
        <YourBlock viewer={viewer} primary={primary} below={below} />
        <FormStrip results={overview.form ?? []} />
        <HereNowTable rows={ordered} here={overview.counts.here} playing={overview.counts.playersInMatch} onChallenge={onChallenge} onFreeze={freeze} />
      </div>
      <div className="page-col-b">
        {overview.lastMatch ? <LastMatch last={overview.lastMatch} viewerName={viewer.displayName} nowMs={nowMs} /> : <FirstMatch />}
        <RecentMatches recent={recent} />
      </div>
    </div>
  );
}
