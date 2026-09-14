import { redirect } from "next/navigation";

import { MatchmakingClient } from "@/components/matchmaking/MatchmakingClient";
import { readLobbySession } from "@/lib/matchmaking/profile";

export default async function MatchmakingPage() {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }
  return <MatchmakingClient self={session.player} />;
}
