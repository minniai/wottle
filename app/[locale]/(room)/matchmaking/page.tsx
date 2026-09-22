import { redirect } from "next/navigation";

import { QueueRoom } from "@/components/room/QueueRoomController";
import { localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function MatchmakingPage({ params }: { params?: LocaleParams } = {}) {
  const locale = await readLocaleParam(params);
  const session = await readLobbySession();
  if (!session) {
    redirect(localePath(locale, "/"));
  }
  return <QueueRoom viewer={session.player} />;
}
