"use server";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { aggregateRoundSummary, calculateWordScore } from "@/lib/scoring/roundSummary";
import { recordScoreSnapshot } from "@/lib/matchmaking/service";
import { withRetry } from "@/lib/game-engine/retry";
import { logPlaytestError, logPlaytestInfo } from "@/lib/observability/log";
import { completeMatchInternal } from "./completeMatch";
import type { RoundSummary, WordScore, ScoreTotals, FrozenTileMap } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";
import type { BoardGrid } from "@/lib/types/board";

/**
 * Publish round summary after a round is completed.
 * This assembles word scores, calculates totals, persists snapshots, and broadcasts via Realtime.
 */
export async function publishRoundSummary(
    matchId: string,
    roundNumber: number
): Promise<RoundSummary | { error: string }> {
    const supabase = getServiceRoleClient();

    // 1. Get round with board snapshots and match player IDs
    const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select("id, board_snapshot_before, board_snapshot_after, match_id")
        .eq("match_id", matchId)
        .eq("round_number", roundNumber)
        .single();

    if (roundError || !round) {
        return { error: "Round not found" };
    }

    const { data: matchPlayers, error: matchError } = await supabase
        .from("matches")
        .select("player_a_id, player_b_id")
        .eq("id", matchId)
        .single();

    if (matchError || !matchPlayers) {
        return { error: "Match not found" };
    }

    // 2. Get word score entries for this round
    const { data: wordEntries, error: wordsError } = await supabase
        .from("word_score_entries")
        .select("*")
        .eq("match_id", matchId)
        .eq("round_id", round.id);

    if (wordsError) {
        return { error: `Failed to fetch word scores: ${wordsError.message}` };
    }

    // 3. Get previous score totals (from scoreboard snapshot or compute from all previous rounds)
    const { data: previousSnapshot } = await supabase
        .from("scoreboard_snapshots")
        .select("player_a_score, player_b_score")
        .eq("match_id", matchId)
        .eq("round_number", roundNumber - 1)
        .maybeSingle();

    const previousTotals: ScoreTotals = previousSnapshot
        ? {
              playerA: previousSnapshot.player_a_score,
              playerB: previousSnapshot.player_b_score,
          }
        : { playerA: 0, playerB: 0 };

    // 4. Convert word_score_entries to WordScore format
    const wordScores: WordScore[] = (wordEntries || []).map((entry) => ({
        playerId: entry.player_id,
        word: entry.word,
        length: entry.length,
        lettersPoints: entry.letters_points,
        bonusPoints: entry.bonus_points,
        totalPoints: entry.total_points,
        coordinates: entry.tiles as Coordinate[],
    }));

    // 5. Aggregate round summary
    const summary = aggregateRoundSummary(
        matchId,
        roundNumber,
        wordScores,
        previousTotals,
        matchPlayers.player_a_id,
        matchPlayers.player_b_id,
    );

    // 6. Persist scoreboard snapshot
    try {
        await recordScoreSnapshot(
            supabase,
            matchId,
            roundNumber,
            summary.totals,
            summary.deltas
        );
    } catch (error) {
        console.error("Failed to persist scoreboard snapshot:", error);
        // Continue anyway - we'll still publish the summary
    }

    // 7. Publish via Realtime broadcast
    const channel = supabase.channel(`match:${matchId}`);
    const broadcastResult = await channel.send({
        type: "broadcast",
        event: "round-summary",
        payload: summary,
    });

    if (broadcastResult === "error") {
        console.error("Failed to broadcast round summary");
        // Still return summary even if broadcast fails
    }

    return summary;
}

/**
 * Persist frozen tiles atomically using conditional update (FR-027).
 *
 * Uses optimistic locking: the UPDATE only succeeds if the current
 * frozen_tiles value matches `previousFrozenTiles`. If stale (another
 * round updated first), reloads current state, recomputes merge, and
 * retries once.
 */
async function persistFrozenTilesAtomically(
    supabase: ReturnType<typeof getServiceRoleClient>,
    matchId: string,
    newFrozenTiles: FrozenTileMap,
    previousFrozenTiles: FrozenTileMap,
): Promise<void> {
    // Attempt conditional update: only apply if frozen_tiles hasn't changed
    const { data, error } = await supabase
        .rpc("update_frozen_tiles_if_unchanged", {
            p_match_id: matchId,
            p_new_frozen_tiles: newFrozenTiles,
            p_previous_frozen_tiles: previousFrozenTiles,
        });

    // If RPC doesn't exist yet, fall back to plain update with a log warning
    if (error?.message?.includes("function") || error?.code === "42883") {
        logPlaytestInfo("frozen-tiles.fallback-update", {
            matchId,
            metadata: { reason: "RPC not available, using plain update" },
        });

        const { error: updateError } = await supabase
            .from("matches")
            .update({
                frozen_tiles: newFrozenTiles,
                updated_at: new Date().toISOString(),
            })
            .eq("id", matchId);

        if (updateError) {
            throw new Error(
                `Failed to persist frozen tiles: ${updateError.message}`,
            );
        }
        return;
    }

    if (error) {
        throw new Error(
            `Failed to persist frozen tiles atomically: ${error.message}`,
        );
    }

    // If conditional update returned 0 rows affected, the value was stale
    if (data === 0) {
        logPlaytestInfo("frozen-tiles.stale-retry", {
            matchId,
            metadata: { reason: "Stale frozen_tiles, retrying with fresh state" },
        });

        // Reload current frozen tiles and do a plain update as fallback
        const { data: match } = await supabase
            .from("matches")
            .select("frozen_tiles")
            .eq("id", matchId)
            .single();

        const { error: retryError } = await supabase
            .from("matches")
            .update({
                frozen_tiles: newFrozenTiles,
                updated_at: new Date().toISOString(),
            })
            .eq("id", matchId);

        if (retryError) {
            throw new Error(
                `Failed to persist frozen tiles on retry: ${retryError.message}`,
            );
        }
    }
}

/**
 * Compute word scores from board state and player moves using the word engine.
 * Called by roundEngine after applying moves.
 *
 * Pipeline: getPriorScoredWords → processRoundScoring → persist to word_score_entries → return WordScore[]
 *
 * Wrapped with retry logic (FR-026): retries up to 3 times on failure.
 * On exhaustion, cancels the match and broadcasts error to both players.
 */
export async function computeWordScoresForRound(
    matchId: string,
    roundId: string,
    roundNumber: number,
    boardBefore: BoardGrid,
    boardAfter: BoardGrid,
    acceptedMoves: Array<{ player_id: string; from_x: number; from_y: number; to_x: number; to_y: number; created_at: string }>,
    playerAId: string,
    playerBId: string,
    frozenTiles: Record<string, { owner: string }> = {},
): Promise<WordScore[]> {
    try {
        return await withRetry(
            () => executeScoringPipeline(
                matchId, roundId, roundNumber,
                boardBefore, boardAfter, acceptedMoves,
                playerAId, playerBId, frozenTiles,
            ),
            {
                maxAttempts: 3,
                baseDelayMs: 100,
                onRetry: (attempt, error) => {
                    logPlaytestError("word-engine.scoring.retry", {
                        matchId,
                        roundNumber,
                        metadata: {
                            roundId,
                            attempt,
                            error: error.message,
                        },
                    });
                },
                onExhausted: async (error) => {
                    logPlaytestError("word-engine.scoring.exhausted", {
                        matchId,
                        roundNumber,
                        metadata: {
                            roundId,
                            attempts: error.attempts,
                            error: error.message,
                            stack: error.cause?.stack,
                        },
                    });

                    // FR-026: Cancel match and notify players
                    try {
                        await completeMatchInternal(matchId, "error");
                    } catch (cancelError) {
                        logPlaytestError("word-engine.scoring.cancel-failed", {
                            matchId,
                            metadata: { error: (cancelError as Error).message },
                        });
                    }

                    // Broadcast error to both players via Realtime
                    try {
                        const supabase = getServiceRoleClient();
                        const channel = supabase.channel(`match:${matchId}`);
                        await channel.send({
                            type: "broadcast",
                            event: "match-error",
                            payload: {
                                error: "Scoring pipeline failed. Match has been cancelled.",
                                matchId,
                                roundNumber,
                            },
                        });
                    } catch {
                        // Best effort — match is already cancelled
                    }
                },
            },
        );
    } catch (error) {
        // If retry exhaustion already cancelled the match, return empty scores
        return [];
    }
}

/**
 * Core scoring pipeline logic, extracted for retry wrapping.
 */
async function executeScoringPipeline(
    matchId: string,
    roundId: string,
    roundNumber: number,
    boardBefore: BoardGrid,
    boardAfter: BoardGrid,
    acceptedMoves: Array<{ player_id: string; from_x: number; from_y: number; to_x: number; to_y: number; created_at: string }>,
    playerAId: string,
    playerBId: string,
    frozenTiles: Record<string, { owner: string }>,
): Promise<WordScore[]> {
    const supabase = getServiceRoleClient();

    const { processRoundScoring } = await import("@/lib/game-engine/wordEngine");

    const result = await processRoundScoring({
        matchId,
        roundId,
        roundNumber,
        boardBefore,
        boardAfter,
        acceptedMoves: acceptedMoves.map((m) => ({
            playerId: m.player_id,
            fromX: m.from_x,
            fromY: m.from_y,
            toX: m.to_x,
            toY: m.to_y,
            submittedAt: m.created_at,
        })),
        frozenTiles: frozenTiles as FrozenTileMap,
        playerAId,
        playerBId,
    });

    const allBreakdowns = [...result.playerAWords, ...result.playerBWords];

    if (allBreakdowns.length === 0) {
        return [];
    }

    // Persist word scores to word_score_entries table
    const entries = allBreakdowns.map((bd) => ({
        match_id: matchId,
        round_id: roundId,
        player_id: bd.playerId,
        word: bd.word,
        length: bd.length,
        letters_points: bd.lettersPoints,
        bonus_points: bd.lengthBonus,
        total_points: bd.totalPoints,
        tiles: bd.tiles,
        is_duplicate: false,
    }));

    const { error: insertError } = await supabase
        .from("word_score_entries")
        .insert(entries);

    if (insertError) {
        throw new Error(
            `Failed to persist word scores: ${insertError.message}`,
        );
    }

    // FR-027: Persist updated frozen tiles atomically
    await persistFrozenTilesAtomically(
        supabase,
        matchId,
        result.newFrozenTiles,
        frozenTiles as FrozenTileMap,
    );

    // Convert to WordScore[] format for the round summary pipeline
    return allBreakdowns.map((bd) => ({
        playerId: bd.playerId,
        word: bd.word,
        length: bd.length,
        lettersPoints: bd.lettersPoints,
        bonusPoints: bd.lengthBonus,
        totalPoints: bd.totalPoints,
        coordinates: bd.tiles,
    }));
}

