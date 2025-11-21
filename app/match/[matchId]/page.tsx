import { redirect } from "next/navigation";

import { MatchClient } from "@/components/match/MatchClient";
import { loadMatchState } from "@/lib/match/stateLoader";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

interface MatchPageParams {
  matchId: string;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<MatchPageParams> | MatchPageParams;
}) {
  const { matchId } = await params;
  const session = await readLobbySession();

  if (!session) {
    redirect("/");
  }

  const supabase = getServiceRoleClient();
  const matchState = await loadMatchState(supabase, matchId);

  if (!matchState) {
    return <div>Match not found</div>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6 text-white">
      <MatchClient
        currentPlayerId={session.player.id}
        initialState={matchState}
        matchId={matchId}
      />
    </main>
  );
}


