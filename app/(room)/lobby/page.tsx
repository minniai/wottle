import { redirect } from "next/navigation";

import { readLobbySession } from "@/lib/matchmaking/profile";

import { LobbyRoomPage } from "../LobbyRoomPage";

export default async function LobbyPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }
  return <LobbyRoomPage session={session} />;
}
