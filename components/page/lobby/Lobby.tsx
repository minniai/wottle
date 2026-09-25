"use client";

import { useState } from "react";

import Link from "next/link";

import { useCopy, useLocalePath } from "@/components/i18n/LocaleProvider";
import { orderRows } from "@/lib/pages/lobbyRows";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { LobbyRow, Overview } from "@/lib/types/standing";

import { FormStrip } from "./FormStrip";
import type { SendChallengeActionResult } from "@/app/actions/challenge/send";

import { LINK_TTL_MS } from "@/lib/constants/links";
import { lobbyPrimary, type PagePrimaryModel } from "@/lib/pages/pagePrimary";

import { HereNowTable, type RowOverlay } from "./HereNowTable";
import { LastMatch } from "./LastMatch";
import { RecentMatches } from "./RecentMatches";
import { YourBlock, type LobbyViewer } from "./YourBlock";

export interface LobbyProps {
  viewer: LobbyViewer;
  rows: LobbyRow[];
  overview: Overview;
  recent: RecentGameRow[];
  onFind: () => void;
  onSend: (playerId: string) => Promise<SendChallengeActionResult>;
  /** The viewer's standing as the rows and the composer need it (US3, US4). */
  standing?: { searching: boolean; outgoing: boolean; callUp: boolean; overlays: Map<string, RowOverlay>; closed?: boolean; link?: boolean };
  /** Spec 072: `invite a friend ▸`. Without it (a fixture) no invite control is drawn. */
  onInvite?: () => void;
  /** The block's primary for the slot's state (US4; pagePrimary). Without one, find is the primary. */
  primaryFor?: (composing: boolean) => PagePrimaryModel;
  /** `tell me when someone is here ▸` in an empty lobby (US2.6, Q4). */
  arrival?: { armed: boolean; arm: () => void; cancel: () => void };
  /** Fixtures only: a row whose composer is open on first paint (LobbyComposer). */
  initialOpenId?: string | null;
}

const NO_STANDING = { searching: false, outgoing: false, callUp: false, overlays: new Map<string, RowOverlay>() };

/** While your match runs, no row offers a challenge (B8). */
function closedOverlays(rows: LobbyRow[]): Map<string, RowOverlay> {
  return new Map(rows.map((r) => [r.playerId, { action: "none" as const }]));
}

/** A new player's last-match slot: no prior match is represented as an empty state. */
function FirstMatch() {
  const copy = useCopy();
  const to = useLocalePath();
  return (
    <section className="last-match last-match--first">
      <h2 className="page-caption">{copy.pages.LAST_MATCH}</h2>
      <p className="page-sentence">{copy.pages.FIRST_MATCH}</p>
      <Link href={to("/rules")} className="page-link page-link--ink">{copy.HOW_TO_PLAY}</Link>
    </section>
  );
}

/**
 * The lobby (spec 070 US2, game flow B1): your block and form, who is here,
 * your last match and your last matches. No field and no hint.
 */
/** `invite a friend ▸` below the table (spec 072 B1), with its note. */
function InviteBelow({ onInvite, note, hidden }: { onInvite: () => void; note: string | null; hidden: boolean }) {
  const copy = useCopy();
  // Its line is kept while a standing state holds it back, so nothing below moves (SC-006).
  return (
    <p className="lobby-invite" style={hidden ? { visibility: "hidden" } : undefined} aria-hidden={hidden || undefined}>
      <button type="button" className="page-link page-link--ink" onClick={onInvite} data-testid="lobby-invite">
        {copy.pages.INVITE_A_FRIEND}
      </button>
      {note ? <span className="page-label lobby-invite__note">{note}</span> : null}
    </p>
  );
}

export function Lobby({ viewer, rows, overview, recent, onFind, onSend, onInvite, standing = NO_STANDING, initialOpenId = null, primaryFor, arrival }: LobbyProps) {
  const copy = useCopy();
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [composing, setComposing] = useState(initialOpenId !== null);
  const ordered = orderRows(rows, viewer.rating, frozen);
  const freeze = (on: boolean) => setFrozen(on ? ordered.map((r) => r.playerId) : null);
  const empty = rows.length === 0;
  const pageModel = primaryFor ? primaryFor(composing) : { find: composing ? ("secondary" as const) : ("primary" as const), note: null };
  const plan = onInvite ? lobbyPrimary({ othersHere: rows.length, find: pageModel, copy }) : { invite: "hidden" as const, find: pageModel, inviteNote: null };
  const model = plan.find;
  const invitePrimary =
    plan.invite === "primary" && onInvite ? (
      <button type="button" className="lobby-block__find action-primary page-primary" onClick={onInvite} data-testid="lobby-invite">
        {copy.pages.INVITE_A_FRIEND}
      </button>
    ) : null;
  const findButton =
    model.find === "hidden" ? null : (
      <button type="button" className={`lobby-block__find ${model.find === "secondary" ? "page-link page-link--ink" : "action-primary page-primary"}`} onClick={onFind} data-testid="lobby-find">
        {copy.FIND_OPPONENT}
      </button>
    );
  const primary = invitePrimary ? (
    <>
      {invitePrimary}
      {findButton}
    </>
  ) : (
    findButton
  );
  const noteLine = model.note ?? (empty ? copy.pages.PAIRED_ON_ARRIVAL : model.find === "hidden" ? null : copy.pages.searchingNow(overview.counts.searching));
  const below = (
    <>
      {noteLine ? <p className="page-label lobby-block__note">{noteLine}</p> : null}
      {empty && arrival ? (
        <button type="button" className="page-link page-link--ink" onClick={arrival.armed ? arrival.cancel : arrival.arm} data-testid="lobby-tell-me">
          {arrival.armed ? copy.pages.WE_WILL_TELL : copy.pages.TELL_ME}
        </button>
      ) : null}
    </>
  );
  return (
    <div className="page-columns lobby" data-composing={composing} data-find={model.find} data-invite={plan.invite}>
      <div className="page-col-a">
        <YourBlock viewer={viewer} primary={primary} below={below} />
        <FormStrip results={overview.form ?? []} />
        <HereNowTable
          rows={ordered}
          here={rows.filter((r) => r.state === "here" || r.state === "searching").length}
          playing={rows.filter((r) => r.state === "in_match").length}
          onFreeze={freeze}
          composer={{ viewer: { rating: viewer.rating, gamesPlayed: viewer.gamesPlayed }, searching: standing.searching, outgoing: standing.outgoing, callUp: standing.callUp, link: standing.link ?? false }}
          overlays={standing.closed ? closedOverlays(rows) : standing.overlays}
          onSend={onSend}
          onComposing={setComposing}
          initialOpenId={initialOpenId}
        />
        {plan.invite !== "primary" && onInvite && !empty ? <InviteBelow onInvite={onInvite} note={plan.inviteNote ?? copy.pages.linkWorksFor(LINK_TTL_MS / 60_000)} hidden={plan.invite === "hidden"} /> : null}
      </div>
      <div className="page-col-b">
        {overview.lastMatch ? <LastMatch last={overview.lastMatch} viewerName={viewer.displayName} nowMs={nowMs} /> : <FirstMatch />}
        <RecentMatches recent={recent} />
      </div>
    </div>
  );
}
