"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { sendInviteAction } from "@/app/actions/matchmaking/sendInvite";
import { useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useLobbyList } from "@/components/standing/hooks/useLobbyList";
import { useStandingSlot } from "@/components/standing/StandingProvider";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { LobbyLanguage, LobbyRow, Overview } from "@/lib/types/standing";

import { PageFrame } from "../PageFrame";
import { Lobby } from "./Lobby";
import type { LobbyViewer } from "./YourBlock";

export interface LobbyPageProps {
  viewer: LobbyViewer;
  rows: LobbyRow[];
  overview: Overview;
  recent: RecentGameRow[];
}

/** `/` signed in (spec 070 US2): the lobby in its page frame; who is here follows the lobby's pokes. */
export function LobbyPage({ viewer, rows: initialRows, overview, recent }: LobbyPageProps) {
  const locale = useLocale();
  const language = locale.language as LobbyLanguage;
  const to = useLocalePath();
  const router = useRouter();
  const standing = useStandingSlot();
  const rows = useLobbyList(language, initialRows);
  const onFind = useCallback(() => router.push(to("/matchmaking")), [router, to]);
  const onChallenge = useCallback(
    (playerId: string) => {
      void sendInviteAction(playerId, language).then((r) => r.status === "accepted" && r.matchId && router.push(to(`/match/${r.matchId}`)));
    },
    [language, router, to],
  );
  return (
    <PageFrame
      variant="signedIn"
      place="lobby"
      viewer={{ displayName: viewer.displayName, handle: viewer.handle }}
      otherLobbyHere={standing.otherLobbyHere ?? overview.counts.other.here}
      slot={standing.slot}
      signOut={standing.signOut}
      menuExtra={standing.menuExtra}
    >
      <Lobby viewer={viewer} rows={rows} overview={overview} recent={recent} onFind={onFind} onChallenge={onChallenge} />
    </PageFrame>
  );
}
