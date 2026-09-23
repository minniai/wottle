import type { ReactNode } from "react";

import { RoomShell } from "@/components/room/RoomShell";
import { getLocale } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readReturningPlayer } from "@/lib/auth/returningPlayer";
import { readLobbySession, viewerInLanguage } from "@/lib/matchmaking/profile";

/**
 * One persisting shell for every room route (`/`, `/lobby`, `/matchmaking`,
 * `/match/[id]`). The session is read once here; child pages hydrate the room
 * store and never remount the field (spec 044, research R5).
 */
export default async function RoomLayout({ children, params }: { children: ReactNode; params?: LocaleParams }) {
  const locale = await readLocaleParam(params);
  const session = await readLobbySession();
  const { language } = getLocale(locale);
  const viewer = session ? await viewerInLanguage(session.player, language) : null;
  const returning = session ? null : await readReturningPlayer(language);
  return (
    <RoomShell viewer={viewer} returning={returning}>
      {children}
    </RoomShell>
  );
}
