import { redirect } from "next/navigation";

import { localePath } from "@/lib/i18n/locales";
import { readLocaleParam, type LocaleParams } from "@/lib/i18n/params";
import { readLobbySession } from "@/lib/matchmaking/profile";

import { LobbyRoomPage } from "../LobbyRoomPage";

export default async function LobbyPage({ params }: { params?: LocaleParams } = {}) {
  const locale = await readLocaleParam(params);
  const session = await readLobbySession();
  if (!session) {
    redirect(localePath(locale, "/"));
  }
  return <LobbyRoomPage session={session} />;
}
