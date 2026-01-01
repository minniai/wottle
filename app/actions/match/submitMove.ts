"use server";

import { revalidatePath } from "next/cache";

import { applySwap } from "@/lib/game-engine/board";
import { assertWithinRateLimit } from "@/lib/rate-limiting/middleware";
import { boardGridSchema } from "@/lib/types/board";
import type { BoardGrid, MoveResult } from "@/lib/types/board";
import { advanceRound } from "@/lib/match/roundEngine";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { getServiceRoleClient } from "@/lib/supabase/server";

export async function submitMove(
    matchId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
): Promise<MoveResult | { error: string }> {
    const session = await readLobbySession();
    if (!session) {
        return { error: "Unauthorized" };
    }
    const user = session.player;
    const supabase = getServiceRoleClient();

    assertWithinRateLimit({
        identifier: user.id,
        scope: "match:submit-move",
        limit: 30,
        windowMs: 60_000,
        errorMessage: "Too many move submissions. Please slow down before trying again.",
    });

    // 1. Get match to check round and validate player is in match
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("current_round, state, player_a_id, player_b_id")
        .eq("id", matchId)
        .single();

    if (matchError || !match) {
        return { error: "Match not found" };
    }

    if (match.state !== "in_progress") {
        return { error: "Match is not in progress" };
    }

    // Validate player is in match
    if (user.id !== match.player_a_id && user.id !== match.player_b_id) {
        return { error: "You are not a player in this match" };
    }

    // 2. Get current round to get round_id and board state
    const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select("id, state, board_snapshot_before")
        .eq("match_id", matchId)
        .eq("round_number", match.current_round)
        .single();

    if (roundError || !round) {
        return { error: "Round not found" };
    }

    if (round.state !== "collecting") {
        return { error: "Round is no longer accepting submissions" };
    }

    // Get current board state
    let currentBoard: BoardGrid;
    try {
        currentBoard = boardGridSchema.parse(round.board_snapshot_before);
    } catch {
        return { error: "Invalid board state" };
    }

    // 3. Validate move (bounds check)
    if (fromX < 0 || fromX > 9 || fromY < 0 || fromY > 9 || toX < 0 || toX > 9 || toY < 0 || toY > 9) {
        return {
            status: "rejected",
            grid: currentBoard,
            error: "Invalid coordinates: must be between 0 and 9",
        };
    }

    // Validate not swapping same tile
    if (fromX === toX && fromY === toY) {
        return {
            status: "rejected",
            grid: currentBoard,
            error: "Cannot swap a tile with itself",
        };
    }

    // 4. Check if player already submitted for this round
    const { data: existingSubmission } = await supabase
        .from("move_submissions")
        .select("id")
        .eq("round_id", round.id)
        .eq("player_id", user.id)
        .maybeSingle();

    if (existingSubmission) {
        return {
            status: "rejected",
            grid: currentBoard,
            error: "Move already submitted for this round",
        };
    }

    // 5. Insert submission
    const { error: insertError } = await supabase
        .from("move_submissions")
        .insert({
            round_id: round.id,
            player_id: user.id,
            from_x: fromX,
            from_y: fromY,
            to_x: toX,
            to_y: toY,
            status: "pending",
        });

    if (insertError) {
        // Handle duplicate submission (unique constraint on round_id, player_id)
        if (insertError.code === "23505") {
            return {
                status: "rejected",
                grid: currentBoard,
                error: "Move already submitted for this round",
            };
        }
        return { error: "Failed to submit move" };
    }

    // 6. Apply swap to current board for optimistic UI feedback
    // Note: The round's board_snapshot_before won't change until round resolves,
    // but we return the swapped board so the user sees their move immediately
    let swappedBoard: BoardGrid;
    try {
        swappedBoard = applySwap(currentBoard, {
            from: { x: fromX, y: fromY },
            to: { x: toX, y: toY },
        });
    } catch (e) {
        // If swap fails (shouldn't happen after validation), return current board
        console.error("Failed to apply swap for UI preview:", e);
        swappedBoard = currentBoard;
    }

    // 7. Trigger round advancement check (async - don't block response)
    advanceRound(matchId).catch((e) => {
        console.error("Failed to advance round:", e);
    });

    revalidatePath(`/match/${matchId}`);
    return {
        status: "accepted",
        grid: swappedBoard, // Return board with swap applied for immediate visual feedback
    };
}
