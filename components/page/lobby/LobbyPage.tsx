"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { sendChallengeAction } from "@/app/actions/challenge/send";
import { useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { useArrivalWatch } from "@/components/standing/hooks/useArrivalWatch";
import { useLobbyList } from "@/components/standing/hooks/useLobbyList";
import { useStandingSlot } from "@/components/standing/StandingProvider";
import type { RecentGameRow } from "@/lib/types/lobby";
import type { LobbyLanguage, LobbyRow, Overview } from "@/lib/types/standing";

import { PageFrame } from "../PageFrame";
import { Lobby } from "./Lobby";
import type { LobbyViewer } from "./YourBlock";

const NO_ARRIVAL = () => undefined;

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
  const machine = standing.machine;
  const onFind = useCallback(() => machine?.search.start(), [machine]);
  const arrival = useArrivalWatch(rows, machine?.announceArrival ?? NO_ARRIVAL);
  const onSend = useCallback(
    async (playerId: string) => {
      const result = await sendChallengeAction({ recipientId: playerId });
      if (result.status === "crossed") router.push(to(`/match/${result.matchId}`));
      // Sending pokes the recipient; the sender reads its own standing now.
      machine?.refresh();
      return result;
    },
    [router, to, machine],
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
      bottomSlot={standing.bottomSlot}
      bottomHeight={standing.bottomHeight}
      skipLabel={standing.skipLabel}
    >
      <Lobby
        viewer={viewer}
        rows={rows}
        overview={standing.machine?.facts ? { ...overview, counts: { ...overview.counts, searching: standing.machine.facts.counts.searching } } : overview}
        recent={recent}
        onFind={onFind}
        onSend={onSend}
        standing={
          machine
            ? { searching: machine.slot.kind === "search", outgoing: machine.facts?.outgoing?.status === "pending", callUp: machine.slot.kind === "call", overlays: machine.overlays, closed: machine.closed }
            : undefined
        }
        primaryFor={machine?.primaryFor}
        arrival={arrival}
      />
    </PageFrame>
  );
}
