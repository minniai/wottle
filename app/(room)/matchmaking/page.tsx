import { redirect } from "next/navigation";

import { QueueRoom } from "@/components/room/QueueRoomController";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function MatchmakingPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }
  return <QueueRoom viewer={session.player} />;
}
