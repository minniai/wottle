import { getServiceRoleClient } from "../supabase/server";
import { resolveConflicts } from "./conflictResolver";
import { MatchState, MoveSubmission } from "@/lib/types/match";

export async function advanceRound(matchId: string) {
    const supabase = getServiceRoleClient();

    // 1. Fetch current match state and submissions
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

    if (matchError || !match) throw new Error("Match not found");

    const currentRound = match.current_round;

    const { data: submissions, error: subError } = await supabase
        .from("move_submissions")
        .select("*")
        .eq("match_id", matchId)
        .eq("round_number", currentRound);

    if (subError) throw new Error("Failed to fetch submissions");

    // 2. Check if we have submissions from all active players
    // For 2-player playtest, we expect 2 submissions.
    // In a real scenario, we'd check against the player list.
    if (submissions.length < 2) {
        return { status: "waiting" };
    }

    // 3. Resolve conflicts
    const { acceptedMoves, rejectedMoves } = resolveConflicts(submissions);

    // 4. Apply moves to board (logic to be added, for now just advancing round)
    // We would update the board_state here.

    // 5. Score the round (logic to be added)

    // 6. Advance to next round
    const nextRound = currentRound + 1;
    const isGameOver = nextRound > 10;

    const updatePayload: any = {
        current_round: nextRound,
        updated_at: new Date().toISOString(),
    };

    if (isGameOver) {
        updatePayload.status = "completed";
        updatePayload.ended_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
        .from("matches")
        .update(updatePayload)
        .eq("id", matchId);

    if (updateError) throw new Error("Failed to update match");

    // 7. Notify players via Realtime (handled by Postgres changes or separate broadcast)

    return { status: "advanced", nextRound, isGameOver };
}
