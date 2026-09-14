import { redirect } from "next/navigation";

import { LobbyRoomController } from "@/components/room/LobbyRoomController";
import { readLobbySession } from "@/lib/matchmaking/profile";

/** Landing = the lobby room with an empty bottom seat (spec 044 US7). Signed-in visitors continue to /lobby. */
export default async function LandingPage() {
  const session = await readLobbySession();
  if (session) {
    redirect("/lobby");
  }
  return <LobbyRoomController viewer={null} initialPlayers={[]} recentGames={null} />;
}
