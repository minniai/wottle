import { getServiceRoleClient } from "@/lib/supabase/server";
import { resolveConflicts } from "./conflictResolver";
import { MoveSubmission } from "@/lib/types/match";
import { applySwap, type BoardGrid } from "@/lib/game-engine/board";
import { boardGridSchema } from "@/lib/types/board";
import type { MoveRequest } from "@/lib/types/board";
import { publishMatchState } from "./statePublisher";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { publishRoundSummary, computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";
import { trackRoundCompleted } from "@/lib/observability/log";
import { isClockExpired, computeElapsedMs } from "./clockEnforcer";

type MatchRow = {
    id: string;
    current_round: number;
    state: string;
    player_a_id: string;
    player_b_id: string;
    board_seed: string | null;
    frozen_tiles: Record<string, unknown> | null;
    player_a_timer_ms: number | null;
    player_b_timer_ms: number | null;
};

type RoundRow = {
    id: string;
    state: string;
    board_snapshot_before: unknown;
    started_at: string | null;
};

type SubmissionRow = {
    id: string;
    player_id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    submitted_at: string;
    status: string;
};

/** Identify which player slot is absent from submissions. */
function findAbsentPlayerId(
    match: MatchRow,
    submissions: SubmissionRow[],
): string | null {
    const submitterIds = new Set(submissions.map((s) => s.player_id));
    if (!submitterIds.has(match.player_a_id)) return match.player_a_id;
    if (!submitterIds.has(match.player_b_id)) return match.player_b_id;
    return null;
}

function getAbsentTimerMs(match: MatchRow, absentPlayerId: string): number {
    return absentPlayerId === match.player_a_id
        ? (match.player_a_timer_ms ?? 300_000)
        : (match.player_b_timer_ms ?? 300_000);
}

async function insertTimeoutSubmission(
    supabase: ReturnType<typeof getServiceRoleClient>,
    roundId: string,
    playerId: string,
): Promise<void> {
    await supabase.from("move_submissions").insert({
        round_id: roundId,
        player_id: playerId,
        from_x: 0,
        from_y: 0,
        to_x: 0,
        to_y: 0,
        status: "timeout",
        submitted_at: new Date().toISOString(),
    });
}

async function maybeSynthesizeTimeoutPass(
    supabase: ReturnType<typeof getServiceRoleClient>,
    match: MatchRow,
    round: RoundRow,
    submissions: SubmissionRow[],
): Promise<SubmissionRow[]> {
    if (submissions.length !== 1 || !round.started_at) {
        return submissions;
    }

    const absentPlayerId = findAbsentPlayerId(match, submissions);
    if (!absentPlayerId) return submissions;

    const absentTimerMs = getAbsentTimerMs(match, absentPlayerId);
    const roundStartedAt = new Date(round.started_at);
    if (!isClockExpired(roundStartedAt, absentTimerMs)) {
        return submissions;
    }

    const now = new Date().toISOString();
    await insertTimeoutSubmission(supabase, round.id, absentPlayerId);

    // Append the synthetic timeout submission in-memory rather than re-fetching
    const syntheticSubmission: SubmissionRow = {
        id: `timeout-${absentPlayerId}`,
        player_id: absentPlayerId,
        from_x: 0,
        from_y: 0,
        to_x: 0,
        to_y: 0,
        submitted_at: now,
        status: "timeout",
    };

    return [...submissions, syntheticSubmission];
}

function deductTimerMs(
    timerMs: number,
    submission: SubmissionRow | undefined,
    roundStartedAt: Date,
): number {
    if (!submission) return timerMs;
    const elapsed = computeElapsedMs(roundStartedAt, new Date(submission.submitted_at));
    return Math.max(0, timerMs - elapsed);
}

export async function advanceRound(matchId: string) {
    const supabase = getServiceRoleClient();
    const roundStart = Date.now();

    // 1. Fetch current match state
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("current_round, state, player_a_id, player_b_id, board_seed, frozen_tiles, player_a_timer_ms, player_b_timer_ms")
        .eq("id", matchId)
        .single();

    if (matchError || !match) throw new Error("Match not found");

    if (match.state !== "in_progress") {
        return { status: "not_advancing", reason: "Match is not in progress" };
    }

    const currentRound = (match as MatchRow).current_round;

    // 2. Get current round record (including started_at for clock enforcement)
    const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select("id, state, board_snapshot_before, started_at")
        .eq("match_id", matchId)
        .eq("round_number", currentRound)
        .single();

    if (roundError || !round) throw new Error("Round not found");

    // 3. Check round state - only process if still collecting
    if (round.state !== "collecting") {
        return { status: "not_advancing", reason: `Round is in ${round.state} state` };
    }

    // 4. Fetch pending submissions for this round
    const { data: pendingSubmissions, error: subError } = await supabase
        .from("move_submissions")
        .select("*")
        .eq("round_id", round.id)
        .eq("status", "pending");

    if (subError) throw new Error("Failed to fetch submissions");

    // 4.5. Both-flagged: both clocks expired → end match immediately.
    // This is the "both players ran out of time" scenario (chess: mutual flag).
    // We complete the match on current scores when fewer than 2 submissions exist
    // — even if one player submitted before both timers hit zero, the match ends
    // now rather than waiting for a second submission that can never arrive.
    // When both players HAVE submitted (length === 2), the round proceeds normally
    // because both moves were valid; timer deduction handles the end-of-game check.
    if (pendingSubmissions.length < 2 && (round as RoundRow).started_at) {
        const roundStartedAt = new Date((round as RoundRow).started_at as string);
        const typedMatch = match as MatchRow;
        if (
            isClockExpired(roundStartedAt, typedMatch.player_a_timer_ms ?? 300_000) &&
            isClockExpired(roundStartedAt, typedMatch.player_b_timer_ms ?? 300_000)
        ) {
            await completeMatchInternal(matchId, "timeout");
            return { status: "completed" as const, reason: "both_players_flagged" };
        }
    }

    // 5. Maybe synthesise a timeout submission if absent player's clock expired
    const submissions = await maybeSynthesizeTimeoutPass(
        supabase,
        match as MatchRow,
        round as RoundRow,
        pendingSubmissions as SubmissionRow[],
    );

    // 6. Check if we have submissions from all players (2 for playtest)
    if (submissions.length < 2) {
        return { status: "waiting", received: submissions.length };
    }

    // 7. Resolve conflicts (first-come-first-served for overlapping tiles)
    // Filter out timeout submissions before conflict resolution (they don't lock tiles)
    const nonTimeoutSubs = submissions.filter((s: SubmissionRow) => s.status !== "timeout");
    const mappedSubmissions: MoveSubmission[] = nonTimeoutSubs.map((sub: SubmissionRow) => ({
        id: sub.id,
        match_id: matchId,
        player_id: sub.player_id,
        round_number: currentRound,
        from_x: sub.from_x,
        from_y: sub.from_y,
        to_x: sub.to_x,
        to_y: sub.to_y,
        created_at: sub.submitted_at || new Date().toISOString(),
    }));
    const { acceptedMoves, rejectedMoves } = resolveConflicts(mappedSubmissions);

    // 8. Parse current board state
    let currentBoard: BoardGrid;
    try {
        currentBoard = boardGridSchema.parse(round.board_snapshot_before);
    } catch {
        throw new Error("Invalid board state");
    }

    // 9. Apply all accepted moves sequentially
    let boardAfter = currentBoard;
    for (const move of acceptedMoves) {
        const moveRequest: MoveRequest = {
            from: { x: move.from_x, y: move.from_y },
            to: { x: move.to_x, y: move.to_y },
        };
        try {
            boardAfter = applySwap(boardAfter, moveRequest);
        } catch (error) {
            const rejected = acceptedMoves.splice(acceptedMoves.indexOf(move), 1);
            rejectedMoves.push(...rejected);
            console.error("Failed to apply move:", move, error);
        }
    }

    // 9.5. Mark round as resolving immediately after board computation, before word scoring.
    // This shrinks the window where both clocks appear "paused" (stateLoader sees
    // collecting + both submissions) to < 10ms. Also acts as a write-lock against
    // concurrent advanceRound() calls on the same round.
    // Note: board_snapshot_after is set AFTER word scoring (step 9c) to reflect
    // the word engine's final board state, which may differ from boardAfter if
    // the word engine rejects swaps that touch tiles frozen earlier in the round.
    const { error: updateRoundError } = await supabase
        .from("rounds")
        .update({
            state: "resolving",
            resolution_started_at: new Date().toISOString(),
        })
        .eq("id", round.id);

    if (updateRoundError) throw new Error("Failed to update round state");

    // 9b. Compute word scores from the board delta
    let scoringFinalBoard = boardAfter;
    try {
        const scoringResult = await computeWordScoresForRound(
            matchId,
            round.id,
            currentRound,
            currentBoard,
            acceptedMoves,
            (match as MatchRow).player_a_id,
            (match as MatchRow).player_b_id,
            (match as MatchRow).frozen_tiles as Record<string, { owner: string }> ?? {},
        );
        scoringFinalBoard = scoringResult.finalBoard;
    } catch (e) {
        console.error("[WordEngine] Failed to compute word scores:", e);
    }

    // 9c. Persist the word engine's authoritative board snapshot.
    const { error: boardSnapshotError } = await supabase
        .from("rounds")
        .update({ board_snapshot_after: scoringFinalBoard })
        .eq("id", round.id);

    if (boardSnapshotError) {
        console.error("[RoundEngine] Failed to persist board snapshot:", boardSnapshotError);
    }

    // 10. Update submission statuses (batched in parallel)
    await Promise.all([
        ...acceptedMoves.map((move) =>
            supabase
                .from("move_submissions")
                .update({ status: "accepted" })
                .eq("id", move.id),
        ),
        ...rejectedMoves.map((move) =>
            supabase
                .from("move_submissions")
                .update({
                    status: "rejected_invalid",
                    rejection_reason: "Tile conflict with earlier submission",
                })
                .eq("id", move.id),
        ),
    ]);

    // 11. Mark round as completed
    await supabase
        .from("rounds")
        .update({
            state: "completed",
            completed_at: new Date().toISOString(),
        })
        .eq("id", round.id);

    // 11b. Deduct elapsed time from player timers
    const roundStartedAt = round.started_at ? new Date(round.started_at as string) : null;
    const allSubs = submissions as SubmissionRow[];
    const playerASubmission = allSubs.find((s) => s.player_id === (match as MatchRow).player_a_id);
    const playerBSubmission = allSubs.find((s) => s.player_id === (match as MatchRow).player_b_id);

    const newPlayerATimerMs = roundStartedAt
        ? deductTimerMs((match as MatchRow).player_a_timer_ms ?? 300_000, playerASubmission, roundStartedAt)
        : ((match as MatchRow).player_a_timer_ms ?? 300_000);
    const newPlayerBTimerMs = roundStartedAt
        ? deductTimerMs((match as MatchRow).player_b_timer_ms ?? 300_000, playerBSubmission, roundStartedAt)
        : ((match as MatchRow).player_b_timer_ms ?? 300_000);

    // 12. Advance to next round
    const nextRound = currentRound + 1;
    const bothTimersExhausted = newPlayerATimerMs === 0 && newPlayerBTimerMs === 0;
    const isGameOver = nextRound > 10 || bothTimersExhausted;

    // 13. Create next round if not game over
    if (!isGameOver) {
        const { error: nextRoundError } = await supabase
            .from("rounds")
            .insert({
                match_id: matchId,
                round_number: nextRound,
                state: "collecting",
                board_snapshot_before: boardAfter,
                started_at: new Date().toISOString(),
            });

        if (nextRoundError) {
            console.error("Failed to create next round:", nextRoundError);
        }
    }

    // 14. Update match state (with timer deductions)
    const updatePayload: Record<string, unknown> = {
        current_round: nextRound,
        updated_at: new Date().toISOString(),
        player_a_timer_ms: newPlayerATimerMs,
        player_b_timer_ms: newPlayerBTimerMs,
    };

    if (isGameOver) {
        updatePayload.state = "completed";
        updatePayload.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
        .from("matches")
        .update(updatePayload)
        .eq("id", matchId);

    if (updateError) throw new Error("Failed to update match");

    // 15. Publish round summary and match state — fire-and-forget.
    // Broadcast delivery is best-effort; clients have a 2s safety poll and
    // loadMatchState self-heals on read, so the authoritative DB writes above
    // are what matter. Awaiting here previously stalled step 16 by up to 20s
    // whenever the Realtime channel subscribe timed out in local dev.
    void Promise.allSettled([
        publishRoundSummary(matchId, currentRound),
        publishMatchState(matchId),
    ]).then(([summaryResult, stateResult]) => {
        if (summaryResult.status === "rejected") {
            console.error("Failed to publish round summary:", summaryResult.reason);
        }
        if (stateResult.status === "rejected") {
            console.error("[MatchState] Failed to broadcast match update:", stateResult.reason);
        }
    });

    if (isGameOver) {
        const endReason = nextRound > 10 ? "round_limit" : "timeout";
        try {
            await completeMatchInternal(matchId, endReason);
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
