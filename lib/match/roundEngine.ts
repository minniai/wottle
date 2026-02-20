import { getServiceRoleClient } from "@/lib/supabase/server";
import { resolveConflicts } from "./conflictResolver";
import { MoveSubmission } from "@/lib/types/match";
import { applySwap, type BoardGrid } from "@/lib/game-engine/board";
import { boardGridSchema } from "@/lib/types/board";
import type { MoveRequest } from "@/lib/types/board";
import { publishMatchState } from "./statePublisher";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { trackRoundCompleted } from "@/lib/observability/log";

export async function advanceRound(matchId: string) {
    const supabase = getServiceRoleClient();
    const roundStart = Date.now();

    // Use a transaction to ensure atomicity
    // Note: Supabase client doesn't have explicit transactions in JS, so we'll use row-level locking via SELECT FOR UPDATE pattern
    // For now, we'll rely on unique constraints and optimistic updates

    // 1. Fetch current match state
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("current_round, state, player_a_id, player_b_id, board_seed, frozen_tiles")
        .eq("id", matchId)
        .single();

    if (matchError || !match) throw new Error("Match not found");

    if (match.state !== "in_progress") {
        return { status: "not_advancing", reason: "Match is not in progress" };
    }

    const currentRound = match.current_round;

    // 2. Get current round record
    const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select("id, state, board_snapshot_before")
        .eq("match_id", matchId)
        .eq("round_number", currentRound)
        .single();

    if (roundError || !round) throw new Error("Round not found");

    // 3. Check round state - only process if still collecting
    if (round.state !== "collecting") {
        return { status: "not_advancing", reason: `Round is in ${round.state} state` };
    }

    // 4. Fetch submissions for this round
    const { data: submissions, error: subError } = await supabase
        .from("move_submissions")
        .select("*")
        .eq("round_id", round.id)
        .eq("status", "pending");

    if (subError) throw new Error("Failed to fetch submissions");

    // 5. Check if we have submissions from all players (2 for playtest)
    if (submissions.length < 2) {
        return { status: "waiting", received: submissions.length };
    }

    // 6. Resolve conflicts (first-come-first-served for overlapping tiles)
    // Map database fields to MoveSubmission type (database has submitted_at, not created_at)
    const mappedSubmissions: MoveSubmission[] = submissions.map((sub: any) => ({
        id: sub.id,
        match_id: matchId,
        player_id: sub.player_id,
        round_number: currentRound,
        from_x: sub.from_x,
        from_y: sub.from_y,
        to_x: sub.to_x,
        to_y: sub.to_y,
        created_at: sub.submitted_at || sub.created_at || new Date().toISOString(),
    }));
    const { acceptedMoves, rejectedMoves } = resolveConflicts(mappedSubmissions);

    // 7. Parse current board state
    let currentBoard: BoardGrid;
    try {
        currentBoard = boardGridSchema.parse(round.board_snapshot_before);
    } catch {
        throw new Error("Invalid board state");
    }

    // 8. Apply all accepted moves sequentially
    let boardAfter = currentBoard;
    for (const move of acceptedMoves) {
        const moveRequest: MoveRequest = {
            from: { x: move.from_x, y: move.from_y },
            to: { x: move.to_x, y: move.to_y },
        };
        try {
            boardAfter = applySwap(boardAfter, moveRequest);
        } catch (error) {
            // If swap fails, mark this move as rejected
            const rejected = acceptedMoves.splice(acceptedMoves.indexOf(move), 1);
            rejectedMoves.push(...rejected);
            console.error("Failed to apply move:", move, error);
        }
    }

    // 8b. Compute word scores from the board delta
    try {
        const { computeWordScoresForRound } = await import(
            "@/app/actions/match/publishRoundSummary"
        );
        await computeWordScoresForRound(
            matchId,
            round.id,
            currentBoard,
            boardAfter,
            acceptedMoves,
            match.player_a_id,
            match.player_b_id,
            match.frozen_tiles ?? {},
        );
    } catch (e) {
        console.error("[WordEngine] Failed to compute word scores:", e);
        // Continue — round advancement should not be blocked by scoring errors
    }

    // 9. Update round state to resolving
    const { error: updateRoundError } = await supabase
        .from("rounds")
        .update({
            state: "resolving",
            board_snapshot_after: boardAfter,
            resolution_started_at: new Date().toISOString(),
        })
        .eq("id", round.id);

    if (updateRoundError) throw new Error("Failed to update round state");

    // 10. Update submission statuses
    for (const move of acceptedMoves) {
        await supabase
            .from("move_submissions")
            .update({ status: "accepted" })
            .eq("id", move.id);
    }

    for (const move of rejectedMoves) {
        await supabase
            .from("move_submissions")
            .update({
                status: "rejected_invalid",
                rejection_reason: "Tile conflict with earlier submission",
            })
            .eq("id", move.id);
    }

    // 11. Mark round as completed
    await supabase
        .from("rounds")
        .update({
            state: "completed",
            completed_at: new Date().toISOString(),
        })
        .eq("id", round.id);

    // 12. Advance to next round
    const nextRound = currentRound + 1;
    const isGameOver = nextRound > 10;

    // 13. Create next round if not game over
    if (!isGameOver) {
        const { error: nextRoundError } = await supabase
            .from("rounds")
            .insert({
                match_id: matchId,
                round_number: nextRound,
                state: "collecting",
                board_snapshot_before: boardAfter, // New round starts with board after previous round
            });

        if (nextRoundError) {
            console.error("Failed to create next round:", nextRoundError);
            // Continue anyway - we'll update match state
        }
    }

    // 14. Update match state
    const updatePayload: any = {
        current_round: nextRound,
        updated_at: new Date().toISOString(),
    };

    if (isGameOver) {
        updatePayload.state = "completed";
    }

    const { error: updateError } = await supabase
        .from("matches")
        .update(updatePayload)
        .eq("id", matchId);

    if (updateError) throw new Error("Failed to update match");

    // 15. Publish round summary (scores will be computed when word-finder is integrated)
    // For now, this will publish an empty summary if no word scores exist
    try {
        const { publishRoundSummary } = await import("@/app/actions/match/publishRoundSummary");
        await publishRoundSummary(matchId, currentRound).catch((e: unknown) => {
            console.error("Failed to publish round summary:", e);
            // Continue anyway - round is already advanced
        });
    } catch (e) {
        console.error("Failed to load publishRoundSummary:", e);
    }

    try {
        await publishMatchState(matchId);
    } catch (error) {
        console.error("[MatchState] Failed to broadcast match update:", error);
    }

    if (isGameOver) {
        try {
            await completeMatchInternal(matchId, "round_limit");
        } catch (error) {
            console.error("[MatchState] Failed to finalize match:", error);
        }
    }

    trackRoundCompleted({
        matchId,
        roundNumber: currentRound,
        acceptedMoves: acceptedMoves.length,
        rejectedMoves: rejectedMoves.length,
        durationMs: Date.now() - roundStart,
        isGameOver,
    });

    return { status: "advanced", nextRound, isGameOver, acceptedMoves: acceptedMoves.length, rejectedMoves: rejectedMoves.length };
}
