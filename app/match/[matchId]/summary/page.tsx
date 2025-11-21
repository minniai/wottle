import { redirect } from "next/navigation";

import { FinalSummary } from "@/components/match/FinalSummary";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { MatchEndedReason, ScoreTotals } from "@/lib/types/match";

interface PlayerRecord {
  id: string;
  username: string;
  display_name: string;
}

const BASE_TIMER_MS = 5 * 60 * 1000;

async function fetchMatchSummary(matchId: string) {
  const supabase = getServiceRoleClient();
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      `
        id,
        state,
        ended_reason,
        winner_id,
        player_a_id,
        player_b_id,
        player_a_timer_ms,
        player_b_timer_ms
      `,
    )
    .eq("id", matchId)
    .single();

  if (error || !match) {
    throw new Error(error?.message ?? "Match not found.");
  }

  const playerIds = [match.player_a_id, match.player_b_id];
  const { data: players } = await supabase
    .from("players")
    .select("id,username,display_name")
    .in("id", playerIds);

  const playerMap = new Map<string, PlayerRecord>(
    (players ?? []).map((player) => [player.id, player as PlayerRecord]),
  );

  const { data: snapshots } = await supabase
    .from("scoreboard_snapshots")
    .select("round_number,player_a_score,player_b_score")
    .eq("match_id", matchId)
    .order("round_number", { ascending: true });

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id,round_number")
    .eq("match_id", matchId);

  const roundMap = new Map<string, number>();
  (rounds ?? []).forEach((round) => {
    roundMap.set(round.id as string, round.round_number as number);
  });

  const { data: wordEntries } = await supabase
    .from("word_score_entries")
    .select("round_id,player_id,word,total_points,length,letters_points,bonus_points")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  const finalScores: ScoreTotals =
    snapshots && snapshots.length > 0
      ? {
          playerA: snapshots.at(-1)!.player_a_score ?? 0,
          playerB: snapshots.at(-1)!.player_b_score ?? 0,
        }
      : { playerA: 0, playerB: 0 };

  return {
    match,
    playerMap,
    snapshots: snapshots ?? [],
    wordEntries: wordEntries ?? [],
    roundMap,
    finalScores,
  };
}

export default async function MatchSummaryPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const session = await readLobbySession();
  if (!session) {
    redirect("/");
  }

  const { matchId } = await params;
  const summary = await fetchMatchSummary(matchId);

  if (summary.match.state !== "completed") {
    redirect(`/match/${matchId}`);
  }

  const participantIds = [summary.match.player_a_id, summary.match.player_b_id];
  if (!participantIds.includes(session!.player.id)) {
    redirect("/");
  }

  const players = [
    {
      id: summary.match.player_a_id,
      username: summary.playerMap.get(summary.match.player_a_id)?.username ?? "Player A",
      displayName:
        summary.playerMap.get(summary.match.player_a_id)?.display_name ?? "Player A",
      score: summary.finalScores.playerA,
      timeRemainingMs: summary.match.player_a_timer_ms ?? BASE_TIMER_MS,
    },
    {
      id: summary.match.player_b_id,
      username: summary.playerMap.get(summary.match.player_b_id)?.username ?? "Player B",
      displayName:
        summary.playerMap.get(summary.match.player_b_id)?.display_name ?? "Player B",
      score: summary.finalScores.playerB,
      timeRemainingMs: summary.match.player_b_timer_ms ?? BASE_TIMER_MS,
    },
  ].map((player) => ({
    ...player,
    timeUsedMs: Math.max(0, BASE_TIMER_MS - player.timeRemainingMs),
  }));

  const wordHistory = summary.wordEntries.map((entry) => ({
    roundNumber: summary.roundMap.get(entry.round_id as string) ?? 0,
    playerId: entry.player_id as string,
    word: entry.word as string,
    totalPoints: entry.total_points as number,
    lettersPoints: entry.letters_points as number,
    bonusPoints: entry.bonus_points as number,
  }));

  const scoreboard = summary.snapshots.map((row) => ({
    roundNumber: row.round_number as number,
    playerAScore: row.player_a_score ?? 0,
    playerBScore: row.player_b_score ?? 0,
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 p-6 text-white">
      <FinalSummary
        currentPlayerId={session!.player.id}
        matchId={matchId}
        winnerId={summary.match.winner_id}
        endedReason={(summary.match.ended_reason as MatchEndedReason) ?? "round_limit"}
        players={players}
        scoreboard={scoreboard}
        wordHistory={wordHistory}
      />
    </main>
  );
}

