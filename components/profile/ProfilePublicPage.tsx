"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendChallengeAction } from "@/app/actions/challenge/send";
import { useCopy, useLocale, useLocalePath } from "@/components/i18n/LocaleProvider";
import { ComposerPanel } from "@/components/page/lobby/ComposerRow";
import { FormStrip } from "@/components/page/lobby/FormStrip";
import { sendError } from "@/components/page/lobby/HereNowTable";
import { useNowTick } from "@/components/room/hooks/useNowTick";
import { useLobbyList } from "@/components/standing/hooks/useLobbyList";
import { useStandingSlot } from "@/components/standing/StandingProvider";
import type { Seat } from "@/lib/constants/seatColors";
import { localePath } from "@/lib/i18n/locales";
import { challengesClosed, rowOverlays } from "@/lib/pages/rowOverlays";
import { presenceFromRow, presenceLine } from "@/lib/profile/presenceLine";
import { profileHandlePath } from "@/lib/profile/readHandle";
import { publicPrimary, type PublicPrimary } from "@/lib/profile/publicPrimary";
import type { LobbyLanguage } from "@/lib/types/standing";
import type { PresenceWord, ProfileView } from "@/lib/types/profile";

import { BestWords, ProfileChart, ProfileHeader, ProfileMatches, RecordRow } from "./ProfileParts";

function PresenceLine({ presence, view }: { presence: PresenceWord; view: ProfileView }) {
  const copy = useCopy();
  return (
    <p className="profile-presence" data-state={presence.state} data-testid="profile-presence">
      {presenceLine(presence, copy, view.otherLanguage.language)}
    </p>
  );
}

/** `challenge ▸` opens the lobby's composer in column B; sending goes through the one send decision (FR-043). */
function ChallengeSlot({ model, view }: { model: Extract<PublicPrimary, { kind: "challenge" }>; view: ProfileView }) {
  const copy = useCopy();
  const to = useLocalePath();
  const router = useRouter();
  const machine = useStandingSlot().machine;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facts = machine?.facts ?? null;
  const send = async () => {
    setOpen(false);
    const result = await sendChallengeAction({ recipientId: view.playerId });
    if (result.status === "crossed") router.push(to(`/match/${result.matchId}`));
    const failed = sendError(result, copy);
    setError(failed && typeof failed === "object" && "error" in failed ? failed.error : null);
    machine?.refresh();
  };
  if (open) {
    const composer = {
      viewer: facts?.viewer ?? { rating: 1200, gamesPlayed: 0 },
      searching: machine?.slot.kind === "search",
      outgoing: facts?.outgoing?.status === "pending",
      callUp: machine?.slot.kind === "call" || machine?.slot.kind === "linkCall",
      link: machine?.linkOut ?? false,
    };
    return <ComposerPanel opponent={{ rating: view.rating }} facts={composer} onSend={() => void send()} onClose={() => setOpen(false)} />;
  }
  return (
    <div className="profile-primary">
      <button type="button" className="action-primary page-primary" onClick={() => setOpen(true)} data-testid="profile-challenge">
        {model.label}
      </button>
      <p className="page-label profile-stakes" data-testid="profile-stakes">{error ?? model.stakes}</p>
    </div>
  );
}

function PrimarySlot({ model, view }: { model: PublicPrimary; view: ProfileView }) {
  const { id: locale } = useLocale();
  switch (model.kind) {
    case "challenge":
      return <ChallengeSlot model={model} view={view} />;
    case "sent":
      return <p className="page-label page-caption--ink profile-sent" data-testid="profile-sent">{model.label}</p>;
    case "enterLobby":
      return (
        <div className="profile-primary">
          <Link href={`${localePath(locale, "/")}?next=${encodeURIComponent(localePath(locale, profileHandlePath(view.handle)))}`} className="action-primary page-primary" data-testid="profile-enter-lobby">
            {model.label}
          </Link>
        </div>
      );
    default:
      return model.reason ? <p className="page-label" data-testid="profile-closed">{model.reason}</p> : null;
  }
}

/** The signed-in viewer's live view of this player: their lobby row when they are in this lobby, else the server's word. */
function useLivePresence(view: ProfileView): PresenceWord {
  const rows = useLobbyList(view.language as LobbyLanguage, []);
  const row = rows.find((r) => r.playerId === view.playerId);
  return row ? presenceFromRow(row) : (view.presence ?? { state: "not_here", movesPlayed: null });
}

function SignedInColumns({ view }: { view: ProfileView }) {
  const copy = useCopy();
  const machine = useStandingSlot().machine;
  const presence = useLivePresence(view);
  const nowMs = useNowTick(true);
  const facts = machine?.facts ?? null;
  const overlay = rowOverlays(facts, machine?.held ?? null, nowMs, copy).get(view.playerId);
  const model = publicPrimary({
    signedIn: true,
    presence,
    overlay,
    closed: challengesClosed(facts) || machine?.slot.kind === "switch",
    viewer: facts?.viewer ?? { rating: 1200, gamesPlayed: 0 },
    owner: { rating: view.rating },
    nowMs,
    copy,
  });
  return <PublicColumns view={view} seat="opp" presence={presence} model={model} matchesCaption={copy.pages.YOUR_MATCHES} />;
}

function PublicColumns({ view, seat, presence, model, matchesCaption }: { view: ProfileView; seat: Seat; presence: PresenceWord; model: PublicPrimary; matchesCaption: string | null }) {
  return (
    <div className="page-columns profile" data-seat={seat} data-testid="profile-page">
      <div className="page-col-a">
        <ProfileHeader view={view} seat={seat} presence={<PresenceLine presence={presence} view={view} />} />
        <ProfileChart points={view.chart} empty={view.chartEmpty} seat={seat} />
        <FormStrip results={view.lastTen} />
        <RecordRow view={view} />
        <BestWords view={view} seat={seat} />
      </div>
      <div className="page-col-b">
        <PrimarySlot model={model} view={view} />
        {matchesCaption ? <ProfileMatches rows={view.matchesList} caption={matchesCaption} dated /> : null}
      </div>
    </div>
  );
}

/**
 * Another player's profile (spec 072 US6, US7, game flow E2, F9): their page
 * in their seat colour, their presence as a word (never a time), and
 * `challenge ▸` as the one primary with the viewer's stakes beneath it. A
 * visitor who is not signed in sees it in `--you` and is offered the lobby.
 * No head-to-head, block or report (phase 2).
 */
export function ProfilePublicPage({ view, signedIn, fixture }: { view: ProfileView; signedIn: boolean; fixture?: { presence: PresenceWord; model: PublicPrimary } }) {
  const copy = useCopy();
  if (fixture) return <PublicColumns view={view} seat={signedIn ? "opp" : "you"} presence={fixture.presence} model={fixture.model} matchesCaption={signedIn ? copy.pages.YOUR_MATCHES : null} />;
  if (!signedIn) {
    const presence = view.presence ?? { state: "not_here" as const, movesPlayed: null };
    return <PublicColumns view={view} seat="you" presence={presence} model={{ kind: "enterLobby", label: copy.ENTER_LOBBY }} matchesCaption={null} />;
  }
  return <SignedInColumns view={view} />;
}
