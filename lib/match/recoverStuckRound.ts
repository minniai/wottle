import "server-only";

import { boardGridSchema } from "@/lib/types/board";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { completeMatchInternal } from "@/app/actions/match/completeMatch";
import { computeWordScoresForRound } from "@/app/actions/match/publishRoundSummary";
import { publishMatchState } from "./statePublisher";
import { resolveConflicts } from "./conflictResolver";
import { computeElapsedMs } from "./clockEnforcer";
import type { MoveSubmission } from "@/lib/types/match";

type Supabase = ReturnType<typeof getServiceRoleClient>;

type MatchRow = {
    id: string;
    state: string;
    current_round: number;
    player_a_id: string;
    player_b_id: string;
    winner_id: string | null;
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
    resolution_started_at: string | null;
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

/**
 * Roll forward a round-advance that stalled mid-pipeline. Called by
 * `stateLoader.ts` self-heal when it detects one of three stuck shapes:
 *
 *   A) `round.state = "resolving"` — step 9.5 of `advanceRound` ran but step 11
 *      (mark completed) didn't. We need to finalize scoring (idempotently) and
 *      mark the round completed, then fall through to shape B.
 *
 *   B) `round.state = "completed"` AND `match.state = "in_progress"` — step 11
 *      ran but step 14 (advance match) didn't. For terminal rounds (round 10
 *      or both timers exhausted) we advance the match to `completed` and call
 *      `completeMatchInternal`. For non-terminal rounds we advance
 *      `current_round` and create the next round — the existing submit-retry
 *      path normally handles these, but we're defensive here.
 *
 *   C) `match.state = "completed"` AND `winner_id IS NULL` — step 14 ran but
 *      step 16 (`completeMatchInternal`) threw. Just re-invoke it;
 *      `completeMatchInternal` is idempotent when `winner_id` is already set.
 *
 * Idempotent on repeat invocation: re-scoring is guarded by checking
 * `word_score_entries` (insert is not upserted), and `completeMatchInternal`
 * early-returns when `winner_id` is already set.
 */
export async function recoverStuckRound(matchId: string): Promise<void> {
    const supabase = getServiceRoleClient();

    const match = await loadMatch(supabase, matchId);
    if (!match) return;

    // Shape C — match already completed but winner not set.
    if (match.state === "completed") {
        if (!match.winner_id) {
            await runCompleteMatch(matchId, "round_limit");
        }
        return;
    }

    // Shape A/B need the current round.
    const round = await loadCurrentRound(supabase, matchId, match.current_round);
    if (!round) return;

    let roundCompleted = round.state === "completed";

    if (round.state === "resolving") {
        await finalizeResolvingRound(supabase, match, round);
        roundCompleted = true;
    }

    if (roundCompleted && match.state === "in_progress") {
        await finalizeCompletedRound(supabase, match, round);
    }

    try {
        await publishMatchState(matchId);
    } catch (error) {
        console.error("[recoverStuckRound] publishMatchState failed:", error);
    }
}

async function loadMatch(supabase: Supabase, matchId: string): Promise<MatchRow | null> {
    const { data, error } = await supabase
        .from("matches")
        .select(
            "id, state, current_round, player_a_id, player_b_id, winner_id, board_seed, frozen_tiles, player_a_timer_ms, player_b_timer_ms",
        )
        .eq("id", matchId)
        .single();
    if (error || !data) {
        if (error) console.error("[recoverStuckRound] failed to load match:", error);
        return null;
    }
    return data as MatchRow;
}

async function loadCurrentRound(
    supabase: Supabase,
    matchId: string,
    roundNumber: number,
): Promise<RoundRow | null> {
    const { data, error } = await supabase
        .from("rounds")
        .select("id, state, board_snapshot_before, started_at, resolution_started_at")
        .eq("match_id", matchId)
        .eq("round_number", roundNumber)
        .single();
    if (error || !data) {
        if (error) console.error("[recoverStuckRound] failed to load round:", error);
        return null;
    }
    return data as RoundRow;
}

async function finalizeResolvingRound(
    supabase: Supabase,
    match: MatchRow,
    round: RoundRow,
): Promise<void> {
    const scoringAlreadyRan = await scoringRan(supabase, round.id);
    const submissions = await fetchSubmissions(supabase, round.id);
    const nonTimeout = submissions.filter((s) => s.status !== "timeout");

    const mapped: MoveSubmission[] = nonTimeout.map((sub) => ({
        id: sub.id,
        match_id: match.id,
        player_id: sub.player_id,
        round_number: match.current_round,
        from_x: sub.from_x,
        from_y: sub.from_y,
        to_x: sub.to_x,
        to_y: sub.to_y,
        created_at: sub.submitted_at,
    }));
    const { acceptedMoves, rejectedMoves } = resolveConflicts(mapped);

    // Re-run submission status updates. Idempotent: already-accepted rows
    // re-update to "accepted" (same value); "pending" rows promote correctly.
    await Promise.all([
        ...acceptedMoves.map((m) =>
            supabase.from("move_submissions").update({ status: "accepted" }).eq("id", m.id),
        ),
        ...rejectedMoves.map((m) =>
            supabase
                .from("move_submissions")
                .update({
                    status: "rejected_invalid",
                    rejection_reason: "Tile conflict with earlier submission",
                })
                .eq("id", m.id),
        ),
    ]);

    if (!scoringAlreadyRan) {
        try {
            const board = boardGridSchema.parse(round.board_snapshot_before);
            await computeWordScoresForRound(
                match.id,
                round.id,
                match.current_round,
                board,
                acceptedMoves.map((m) => ({
                    player_id: m.player_id,
                    from_x: m.from_x,
                    from_y: m.from_y,
                    to_x: m.to_x,
                    to_y: m.to_y,
                    created_at: m.created_at,
                })),
                match.player_a_id,
                match.player_b_id,
                (match.frozen_tiles ?? {}) as Record<string, { owner: string }>,
            );
        } catch (error) {
            console.error("[recoverStuckRound] scoring failed:", error);
        }
    }

    await supabase
        .from("rounds")
        .update({ state: "completed", completed_at: new Date().toISOString() })
        .eq("id", round.id);
}

async function finalizeCompletedRound(
    supabase: Supabase,
    match: MatchRow,
    round: RoundRow,
): Promise<void> {
    const submissions = await fetchSubmissions(supabase, round.id);
    const { newATimerMs, newBTimerMs } = computeDeductedTimers(match, round, submissions);

    const nextRound = match.current_round + 1;
    const bothTimersExhausted = newATimerMs === 0 && newBTimerMs === 0;
    const isGameOver = nextRound > 10 || bothTimersExhausted;

    const updatePayload: Record<string, unknown> = {
        current_round: nextRound,
        updated_at: new Date().toISOString(),
        player_a_timer_ms: newATimerMs,
        player_b_timer_ms: newBTimerMs,
    };
    if (isGameOver) {
        updatePayload.state = "completed";
        updatePayload.completed_at = new Date().toISOString();
    }

    await supabase.from("matches").update(updatePayload).eq("id", match.id);

    if (isGameOver) {
        await runCompleteMatch(match.id, nextRound > 10 ? "round_limit" : "timeout");
    }
}

function computeDeductedTimers(
    match: MatchRow,
    round: RoundRow,
    submissions: SubmissionRow[],
): { newATimerMs: number; newBTimerMs: number } {
    const storedA = match.player_a_timer_ms ?? 300_000;
    const storedB = match.player_b_timer_ms ?? 300_000;
    if (!round.started_at) {
        return { newATimerMs: storedA, newBTimerMs: storedB };
    }

    const roundStartedAt = new Date(round.started_at);
    const subA = submissions.find((s) => s.player_id === match.player_a_id);
    const subB = submissions.find((s) => s.player_id === match.player_b_id);

    const newATimerMs = subA
        ? Math.max(0, storedA - computeElapsedMs(roundStartedAt, new Date(subA.submitted_at)))
        : storedA;
    const newBTimerMs = subB
        ? Math.max(0, storedB - computeElapsedMs(roundStartedAt, new Date(subB.submitted_at)))
        : storedB;

    return { newATimerMs, newBTimerMs };
}

async function scoringRan(supabase: Supabase, roundId: string): Promise<boolean> {
    const { data } = await supabase
        .from("word_score_entries")
        .select("id")
        .eq("round_id", roundId)
        .limit(1);
    return (data ?? []).length > 0;
}

async function fetchSubmissions(supabase: Supabase, roundId: string): Promise<SubmissionRow[]> {
    const { data } = await supabase
        .from("move_submissions")
        .select("*")
        .eq("round_id", roundId);
    return (data ?? []) as SubmissionRow[];
}

async function runCompleteMatch(
    matchId: string,
    reason: "round_limit" | "timeout",
): Promise<void> {
    try {
        await completeMatchInternal(matchId, reason);
    } catch (error) {
        console.error("[recoverStuckRound] completeMatchInternal failed:", error);
    }
}
