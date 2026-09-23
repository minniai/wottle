"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { sendChallengeAction } from "@/app/actions/challenge/send";
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
  const onSend = useCallback(
    async (playerId: string) => {
      const result = await sendChallengeAction({ recipientId: playerId });
      if (result.status === "crossed") router.push(to(`/match/${result.matchId}`));
      return result;
    },
    [router, to],
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
      <Lobby viewer={viewer} rows={rows} overview={overview} recent={recent} onFind={onFind} onSend={onSend} />
    </PageFrame>
  );
}
