import { redirect } from "next/navigation";

import { QueueRoom } from "@/components/room/QueueRoomController";
import { getLocale, localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession, viewerInLanguage } from "@/lib/matchmaking/profile";

export default async function MatchmakingPage({ params }: { params?: LocaleParams } = {}) {
  const locale = await readLocaleParam(params);
  const session = await readLobbySession();
  if (!session) {
    redirect(localePath(locale, "/"));
  }
  return <QueueRoom viewer={await viewerInLanguage(session.player, getLocale(locale).language)} />;
}
