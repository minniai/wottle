import { MatchShell } from "../../../components/match/MatchShell";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { BoardGrid } from "@/components/game/BoardGrid";
import { TimerHud } from "@/components/game/TimerHud";
import { redirect } from "next/navigation";
import { generateBoard } from "@/scripts/supabase/generateBoard";

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

  // Fetch current round's board state
  let currentBoard: string[][] | null = null;
  
  const { data: currentRound } = await supabase
    .from("rounds")
    .select("board_snapshot_before")
    .eq("match_id", matchId)
    .eq("round_number", match.current_round)
    .maybeSingle();

  if (currentRound?.board_snapshot_before) {
    try {
      currentBoard = currentRound.board_snapshot_before as string[][];
    } catch {
      // Failed to parse board snapshot, will generate new one
      console.error("Failed to parse board snapshot");
      currentBoard = null;
    }
  }

  // If no round exists or parsing failed, generate board from match seed
  if (!currentBoard) {
    // Use board_seed or match ID as seed for deterministic board generation
    const seed = match.board_seed || matchId;
    currentBoard = generateBoard({ matchId: seed });
  }

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
            grid={currentBoard}
            matchId={matchId}
          />
        </div>
      </MatchShell>
    </main>
  );
}


