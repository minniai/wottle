"use client";

import { DoorPage } from "@/components/page/door/DoorPage";
import { Lobby } from "@/components/page/lobby/Lobby";
import { PageFrame } from "@/components/page/PageFrame";

import { DOOR_EN, DOOR_IS, lobbyEmpty, lobbyEn, lobbyIs, lobbyNew, type LobbyFixture, type PagePhase } from "./fixtures";

const NO_OP = () => undefined;

function LobbyFixturePage({ fixture }: { fixture: LobbyFixture }) {
  return (
    <PageFrame variant="signedIn" place="lobby" viewer={{ displayName: fixture.viewer.displayName, handle: fixture.viewer.handle }} otherLobbyHere={fixture.overview.counts.other.here}>
      <Lobby viewer={fixture.viewer} rows={fixture.rows} overview={fixture.overview} recent={fixture.recent} onFind={NO_OP} onChallenge={NO_OP} />
    </PageFrame>
  );
}

/** Renders one page phase from static facts (T017); each story adds its phases. */
export function PageFixture({ phase }: { phase: PagePhase }) {
  switch (phase) {
    case "door":
      return <DoorPage overview={DOOR_EN} returning={null} next={null} preferOther={false} />;
    case "is-door":
      return <DoorPage overview={DOOR_IS} returning={null} next={null} preferOther={false} />;
    case "door-returning":
      return <DoorPage overview={DOOR_EN} returning={{ displayName: "Birna", rating: 1310 }} next={null} preferOther={false} />;
    case "lobby":
      return <LobbyFixturePage fixture={lobbyEn()} />;
    case "is-lobby":
      return <LobbyFixturePage fixture={lobbyIs()} />;
    case "lobby-new":
      return <LobbyFixturePage fixture={lobbyNew()} />;
    case "lobby-empty":
      return <LobbyFixturePage fixture={lobbyEmpty()} />;
  }
}
