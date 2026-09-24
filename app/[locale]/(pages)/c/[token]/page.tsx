import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InviteDoorPage } from "@/components/page/door/InviteDoor";
import { readReturningPlayer } from "@/lib/auth/returningPlayer";
import { getCopy } from "@/lib/i18n/getCopy";
import { getLocale, localePath, type Locale } from "@/lib/i18n/locales";
import { readLocaleParam } from "@/lib/i18n/params";
import { lobbyWithInvite } from "@/lib/pages/inviteDoor";
import { publicOverview } from "@/lib/lobby/overview";
import { readLink } from "@/lib/matchmaking/linkService";
import { hashLinkToken, parseLinkToken } from "@/lib/matchmaking/linkToken";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { findActiveMatchForPlayer } from "@/lib/matchmaking/service";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LinkView } from "@/lib/types/link";
import type { LobbyLanguage } from "@/lib/types/standing";

interface InviteParams {
  locale?: string;
  token: string;
}

type Props = { params: Promise<InviteParams> | InviteParams };

/** The link's view, or null for a malformed or unknown token. Reads only (research R4). */
async function viewOf(raw: string): Promise<{ token: string | null; view: LinkView | null }> {
  const token = parseLinkToken(decodeURIComponent(raw));
  return { token, view: token ? await readLink(hashLinkToken(token)) : null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await params;
  const locale = await readLocaleParam(resolved);
  const copy = getCopy(locale);
  const { wordmark } = getLocale(locale);
  const { view } = await viewOf(resolved.token);
  return {
    title: view?.valid ? copy.pages.inviteTitle(view.senderName, wordmark) : copy.pages.doorTitle(wordmark),
    robots: { index: false, follow: false },
  };
}

/**
 * `/c/:token` and `/en/c/:token` (spec 072 FR-010–FR-014, contracts
 * routes-and-actions): renders or redirects, and never writes, so a chat
 * app's preview, a prefetch or a crawler cannot use the link.
 */
export default async function InvitePage({ params }: Props) {
  const resolved = await params;
  const locale = await readLocaleParam(resolved);
  const { token, view } = await viewOf(resolved.token);
  if (token && view && view.language !== getLocale(locale).language) redirect(localePath(view.language as Locale, `/c/${token}`));
  const session = await readLobbySession();
  if (session) {
    const live = await findActiveMatchForPlayer(getServiceRoleClient(), session.player.id).catch(() => null);
    if (live) redirect(localePath(locale, `/match/${live.id}`));
    redirect(token ? lobbyWithInvite(locale, token) : localePath(locale, "/"));
  }
  const language = getLocale(locale).language as LobbyLanguage;
  const [overview, returning] = await Promise.all([
    publicOverview(language).catch(() => ({ counts: { here: 0, searching: 0, playersInMatch: 0, matchesOn: 0, other: { language, here: 0 } }, here: [], more: 0 })),
    readReturningPlayer(language),
  ]);
  return <InviteDoorPage overview={overview} token={token ?? ""} view={view} returning={returning} renderedAt={Date.now()} />;
}
