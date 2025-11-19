"use server";

import { getServiceRoleClient } from "../../../lib/supabase/server";
import { readLobbySession } from "../../../lib/matchmaking/profile";
import { advanceRound } from "../../../lib/match/roundEngine";
import { revalidatePath } from "next/cache";

export async function submitMove(matchId: string, fromX: number, fromY: number, toX: number, toY: number) {
    const session = await readLobbySession();
    if (!session) {
        return { error: "Unauthorized" };
    }
    const user = session.player;
    const supabase = getServiceRoleClient();

    // 2. Get match to check round
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("current_round, status")
        .eq("id", matchId)
        .single();

    if (matchError || !match) {
        return { error: "Match not found" };
    }

    if (match.status !== "in_progress") {
        return { error: "Match is not in progress" };
    }

    // 3. Validate move (basic bounds check)
    if (fromX < 0 || fromX > 9 || fromY < 0 || fromY > 9 || toX < 0 || toX > 9 || toY < 0 || toY > 9) {
        return { error: "Invalid coordinates" };
    }

    // 4. Insert submission
    const { error: insertError } = await supabase
        .from("move_submissions")
        .insert({
            match_id: matchId,
            player_id: user.id,
            round_number: match.current_round,
            from_x: fromX,
            from_y: fromY,
            to_x: toX,
            to_y: toY,
        });

    if (insertError) {
        // Handle duplicate submission (unique constraint on match_id, player_id, round_number)
        if (insertError.code === "23505") {
            return { error: "Move already submitted for this round" };
        }
        return { error: "Failed to submit move" };
    }

    // 5. Trigger round advancement check
    try {
        await advanceRound(matchId);
    } catch (e) {
        console.error("Failed to advance round:", e);
        // Don't fail the submission if advancement fails, just log it.
        // In a real system, we might want to retry or have a background worker.
    }

    revalidatePath(`/match/${matchId}`);
    return { success: true };
}
