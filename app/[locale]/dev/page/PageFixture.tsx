"use client";

import { useEffect } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { DoorPage } from "@/components/page/door/DoorPage";
import { InviteDoorPage } from "@/components/page/door/InviteDoor";
import { ProfileOwnPage } from "@/components/profile/ProfileOwnPage";
import { ProfilePublicPage } from "@/components/profile/ProfilePublicPage";
import { LineSlot } from "@/components/page/LineSlot";
import { Lobby } from "@/components/page/lobby/Lobby";
import { PageFrame } from "@/components/page/PageFrame";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";
import { pagePrimary, type PagePrimaryModel } from "@/lib/pages/pagePrimary";
import type { ProfileView } from "@/lib/types/profile";
import { challengesClosed, rowOverlays } from "@/lib/pages/rowOverlays";
import { phoneSlotHeight, slotLines } from "@/lib/pages/slotLines";

import {
  challengeIn,
  outgoingChallenge,
  DOOR_EN,
  DOOR_IS,
  lobbyEmpty,
  lobbyEn,
  lobbyIs,
  lobbyNew,
  matchOverAway,
  matchRunning,
  searching,
  switchConfirm,
  linkOut,
  INVITE_TOKEN,
  profileView,
  profileViewNew,
  publicProfileView,
  sentToKari,
  linkCallIn,
  ownLinkOpened,
  FIXED_NOW,
  inviteView,
  type LobbyFixture,
  type PagePhase,
  type StandingFixture,
  withLongNames,
} from "./fixtures";

const NO_OP = () => undefined;
const SENT = async () => ({ status: "sent" as const, inviteId: "00000000-0000-4000-8000-000000000999" });

function LobbyFixturePage({ fixture, openRow = null }: { fixture: LobbyFixture; openRow?: string | null }) {
  return (
    <PageFrame variant="signedIn" place="lobby" viewer={{ displayName: fixture.viewer.displayName, handle: fixture.viewer.handle }} otherLobbyHere={fixture.overview.counts.other.here}>
      <Lobby viewer={fixture.viewer} rows={fixture.rows} overview={fixture.overview} recent={fixture.recent} onFind={NO_OP} onSend={SENT} onInvite={NO_OP} initialOpenId={openRow} />
    </PageFrame>
  );
}

/**
 * The lobby with a standing in its line slot, composed from the same pure
 * functions as the standing machine (slotLines, rowOverlays, pagePrimary), with
 * the clock held at the fixture's instant.
 */
function StandingFixturePage({ fixture, standing, focusSkip = false }: { fixture: LobbyFixture; standing: StandingFixture; focusSkip?: boolean }) {
  const copy = useCopy();
  const phone = useIsPhone();
  const { slot, facts, held, now } = standing;
  const languageName = facts.lobbyLanguage === "is" ? copy.pages.LANGUAGE_NAME_IS : copy.pages.LANGUAGE_NAME_EN;
  const model = slotLines(slot, copy, { nowMs: now, phone, viewer: facts.viewer, searchingCount: facts.counts.searching, languageName, linkText: standing.linkText ?? null, clipboardRefused: standing.clipboardRefused ?? false });
  const counts = { here: facts.counts.here, playing: facts.counts.playing };
  // LobbyIncoming shows the skip link focused: it is the page's first stop while a call is up.
  useEffect(() => {
    if (focusSkip) document.querySelector<HTMLElement>('[data-testid="skip-to-call"]')?.focus();
  }, [focusSkip]);
  return (
    <PageFrame
      variant="signedIn"
      place="lobby"
      viewer={{ displayName: fixture.viewer.displayName, handle: fixture.viewer.handle }}
      otherLobbyHere={fixture.overview.counts.other.here}
      slot={<LineSlot model={model} onAction={NO_OP} announcement="" counts={counts} variant="desktop" />}
      bottomSlot={model.style === "terms" ? null : <LineSlot model={model} onAction={NO_OP} announcement="" variant="phone" />}
      bottomHeight={phoneSlotHeight(model)}
      skipLabel={slot.kind === "call" ? copy.pages.skipToCall(slot.call.from.displayName) : slot.kind === "linkCall" ? copy.pages.skipToCall(slot.call.view.senderName) : null}
    >
      <Lobby
        viewer={fixture.viewer}
        rows={fixture.rows}
        overview={fixture.overview}
        recent={fixture.recent}
        onFind={NO_OP}
        onSend={SENT}
        standing={{
          searching: slot.kind === "search",
          outgoing: facts.outgoing?.status === "pending",
          callUp: slot.kind === "call" || slot.kind === "linkCall",
          overlays: rowOverlays(facts, held, now, copy),
          closed: challengesClosed(facts) || slot.kind === "switch",
          link: facts.link?.status === "pending",
        }}
        onInvite={NO_OP}
        primaryFor={(composing) => pagePrimary(slot, copy, { composing })}
      />
    </PageFrame>
  );
}

/** A profile in its page frame, with a standing in the slot when one is given (spec 072 fixtures). */
const HERE_NOW = { state: "here" as const, movesPlayed: null };
const PUBLIC_CHALLENGE_EN = { kind: "challenge" as const, label: "challenge ▸", stakes: "english words · win +7 · draw −1 · loss −9" };
const PUBLIC_CHALLENGE_IS = { kind: "challenge" as const, label: "skora á ▸", stakes: "íslensk orð · sigur +9 · jafntefli +1 · tap −7" };

function ProfileFixturePage({ view, standing, signedOut = false, children }: { view: ProfileView; standing?: StandingFixture; signedOut?: boolean; children: (primary: PagePrimaryModel | undefined) => React.ReactNode }) {
  const copy = useCopy();
  const phone = useIsPhone();
  const model = standing ? slotLines(standing.slot, copy, { nowMs: standing.now, phone, viewer: standing.facts.viewer, searchingCount: 0 }) : null;
  return (
    <PageFrame
      variant="signedIn"
      place="profile"
      viewer={signedOut ? null : { displayName: "Birna", handle: "birna" }}
      otherLobbyHere={7}
      slot={model ? <LineSlot model={model} onAction={NO_OP} announcement="" variant="desktop" /> : undefined}
      bottomSlot={model && model.style !== "terms" ? <LineSlot model={model} onAction={NO_OP} announcement="" variant="phone" /> : null}
      bottomHeight={model ? phoneSlotHeight(model) : 0}
      folioDetail={view.handle}
    >
      {children(standing ? pagePrimary(standing.slot, copy, { composing: false }) : undefined)}
    </PageFrame>
  );
}

/** Renders one page phase from static facts (T017); each story adds its phases. */
export function PageFixture({ phase, long = false }: { phase: PagePhase; long?: boolean }) {
  // `long`: every name at the 24-character limit, for the overflow test (SC-007).
  const L = <T,>(fixture: T): T => (long ? withLongNames(fixture) : fixture);
  switch (phase) {
    case "door":
      return <DoorPage overview={L(DOOR_EN)} returning={null} next={null} preferOther={false} />;
    case "is-door":
      return <DoorPage overview={L(DOOR_IS)} returning={null} next={null} preferOther={false} />;
    case "door-returning":
      return <DoorPage overview={L(DOOR_EN)} returning={L({ displayName: "Birna", rating: 1310 })} next={null} preferOther={false} />;
    case "lobby":
      return <LobbyFixturePage fixture={L(lobbyEn())} />;
    case "is-lobby":
      return <LobbyFixturePage fixture={L(lobbyIs())} />;
    case "lobby-new":
      return <LobbyFixturePage fixture={L(lobbyNew())} />;
    case "lobby-empty":
      return <LobbyFixturePage fixture={L(lobbyEmpty())} />;
    // LobbyComposer (EN-L) and PhoneComposer (IS-T1): Embla's row open.
    case "composer":
      return <LobbyFixturePage fixture={L(lobbyEn())} openRow={lobbyEn().rows[0].playerId} />;
    case "is-composer":
      return <LobbyFixturePage fixture={L(lobbyIs())} openRow={lobbyIs().rows[0].playerId} />;
    case "challenge-sent":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(outgoingChallenge())} />;
    case "is-challenge-in":
      return <StandingFixturePage fixture={L(lobbyIs())} standing={L(challengeIn())} focusSkip />;
    case "match-running":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(matchRunning())} />;
    case "match-over-away":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(matchOverAway())} />;
    case "searching":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(searching())} />;
    case "switch-confirm":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(switchConfirm())} />;
    case "lobby-link-out":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(linkOut("en"))} />;
    case "is-lobby-link-out":
      return <StandingFixturePage fixture={L(lobbyIs())} standing={L(linkOut("is"))} />;
    case "invite-door":
      return <InviteDoorPage overview={L(DOOR_EN)} token={INVITE_TOKEN} view={inviteView("en")} returning={null} renderedAt={FIXED_NOW} />;
    case "is-invite-door":
      return <InviteDoorPage overview={L(DOOR_IS)} token={INVITE_TOKEN} view={inviteView("is")} returning={null} renderedAt={FIXED_NOW} />;
    case "invite-door-expired":
      return <InviteDoorPage overview={L(DOOR_EN)} token={INVITE_TOKEN} view={inviteView("en", false)} returning={null} renderedAt={FIXED_NOW} />;
    case "invite-door-returning":
      return <InviteDoorPage overview={L(DOOR_EN)} token={INVITE_TOKEN} view={inviteView("en")} returning={L({ displayName: "Birna", rating: 1310 })} renderedAt={FIXED_NOW} />;
    case "lobby-link-call":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(linkCallIn("en"))} focusSkip />;
    case "is-lobby-link-call":
      return <StandingFixturePage fixture={L(lobbyIs())} standing={L(linkCallIn("is"))} focusSkip />;
    case "lobby-own-link":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(ownLinkOpened())} />;
    case "profile-own":
      return <ProfileFixturePage view={profileView("en")}>{(primary) => <ProfileOwnPage view={L(profileView("en"))} primary={primary} />}</ProfileFixturePage>;
    case "is-profile-own":
      return <ProfileFixturePage view={profileView("is")}>{(primary) => <ProfileOwnPage view={L(profileView("is"))} primary={primary} />}</ProfileFixturePage>;
    case "profile-own-new":
      return <ProfileFixturePage view={profileViewNew()}>{(primary) => <ProfileOwnPage view={profileViewNew()} primary={primary} />}</ProfileFixturePage>;
    case "profile-own-call":
      return <ProfileFixturePage view={profileView("is")} standing={challengeIn()}>{(primary) => <ProfileOwnPage view={L(profileView("is"))} primary={primary} />}</ProfileFixturePage>;
    case "profile-public":
      return <ProfileFixturePage view={publicProfileView()}>{() => <ProfilePublicPage view={L(publicProfileView())} signedIn fixture={{ presence: HERE_NOW, model: PUBLIC_CHALLENGE_EN }} />}</ProfileFixturePage>;
    case "is-profile-public":
      return <ProfileFixturePage view={publicProfileView("is")}>{() => <ProfilePublicPage view={L(publicProfileView("is"))} signedIn fixture={{ presence: HERE_NOW, model: PUBLIC_CHALLENGE_IS }} />}</ProfileFixturePage>;
    case "profile-public-sent":
      return <ProfileFixturePage view={publicProfileView()} standing={sentToKari()}>{() => <ProfilePublicPage view={L(publicProfileView())} signedIn fixture={{ presence: HERE_NOW, model: { kind: "sent", label: "sent · 0:41" } }} />}</ProfileFixturePage>;
    case "profile-public-in-match":
      return <ProfileFixturePage view={publicProfileView()}>{() => <ProfilePublicPage view={L(publicProfileView())} signedIn fixture={{ presence: { state: "in_match", movesPlayed: 6 }, model: { kind: "closed", reason: null } }} />}</ProfileFixturePage>;
    case "profile-public-away":
      return <ProfileFixturePage view={publicProfileView()}>{() => <ProfilePublicPage view={L(publicProfileView())} signedIn fixture={{ presence: { state: "away", movesPlayed: null }, model: { kind: "closed", reason: null } }} />}</ProfileFixturePage>;
    case "profile-public-signed-out":
      return <ProfileFixturePage view={publicProfileView()} signedOut>{() => <ProfilePublicPage view={L(publicProfileView())} signedIn={false} fixture={{ presence: HERE_NOW, model: { kind: "enterLobby", label: "enter the lobby ▸" } }} />}</ProfileFixturePage>;
    case "lobby-link-refused":
      return <StandingFixturePage fixture={L(lobbyEn())} standing={L(linkOut("en", true))} />;
  }
}
