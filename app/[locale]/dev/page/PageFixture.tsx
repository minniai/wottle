"use client";

import { useEffect } from "react";

import { useCopy } from "@/components/i18n/LocaleProvider";
import { DoorPage } from "@/components/page/door/DoorPage";
import { LineSlot } from "@/components/page/LineSlot";
import { Lobby } from "@/components/page/lobby/Lobby";
import { PageFrame } from "@/components/page/PageFrame";
import { useIsPhone } from "@/components/room/hooks/useIsPhone";
import { pagePrimary } from "@/lib/pages/pagePrimary";
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
      <Lobby viewer={fixture.viewer} rows={fixture.rows} overview={fixture.overview} recent={fixture.recent} onFind={NO_OP} onSend={SENT} initialOpenId={openRow} />
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
  const model = slotLines(slot, copy, { nowMs: now, phone, viewer: facts.viewer, searchingCount: facts.counts.searching, languageName });
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
      skipLabel={slot.kind === "call" ? copy.pages.skipToCall(slot.call.from.displayName) : null}
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
          callUp: slot.kind === "call",
          overlays: rowOverlays(facts, held, now, copy),
          closed: challengesClosed(facts) || slot.kind === "switch",
        }}
        primaryFor={(composing) => pagePrimary(slot, copy, { composing })}
      />
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
  }
}
