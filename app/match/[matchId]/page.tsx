import { MatchShell } from "../../../components/match/MatchShell";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { BoardGrid } from "@/components/game/BoardGrid";
import { TimerHud } from "@/components/game/TimerHud";
import { redirect } from "next/navigation";

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

  // Fetch initial match state
  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (error || !match) {
    return <div>Match not found</div>;
  }

  // Mock grid for now - in real implementation this comes from match state or separate table
  // We need to fetch the board state. For MVP scaffold, let's assume a static or random grid if not persisted yet.
  // Actually, the spec mentions "seeded 10x10 board".
  // For this step, I will generate a dummy grid to unblock the UI integration.
  const dummyGrid = Array(10).fill(Array(10).fill("A"));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6 text-white">
      <MatchShell
        matchId={matchId}
        headline={`Match: ${matchId.slice(0, 8)}`}
        statusMessage="Live"
      >
        <div className="flex flex-col items-center w-full">
          <TimerHud
            timeLeft={300} // 5 minutes
            isPaused={false} // TODO: Hook up to real state
            roundNumber={match.current_round}
          />

          <BoardGrid
            grid={dummyGrid}
            matchId={matchId}
          />
        </div>
      </MatchShell>
    </main>
  );
}


