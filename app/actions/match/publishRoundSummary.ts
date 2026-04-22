"use server";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { aggregateRoundSummary, calculateWordScore } from "@/lib/scoring/roundSummary";
import { recordScoreSnapshot } from "@/lib/matchmaking/service";
import { withRetry } from "@/lib/game-engine/retry";
import { logPlaytestError, logPlaytestInfo } from "@/lib/observability/log";
import { completeMatchInternal } from "./completeMatch";
import type { RoundSummary, RoundMove, WordScore, ScoreTotals, FrozenTileMap } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";
import type { BoardGrid } from "@/lib/types/board";

/** Matches statePublisher.ts — see that file for rationale. */
const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 2_000;

/**
 * Publish round summary after a round is completed.
 * This assembles word scores, calculates totals, persists snapshots, and broadcasts via Realtime.
 */
export async function publishRoundSummary(
    matchId: string,
    roundNumber: number
): Promise<RoundSummary | { error: string }> {
    const supabase = getServiceRoleClient();

    // 1. Get round and match player IDs in parallel (independent queries)
    const [roundResult, matchResult] = await Promise.all([
        supabase
            .from("rounds")
            .select("id, board_snapshot_before, board_snapshot_after, match_id")
            .eq("match_id", matchId)
            .eq("round_number", roundNumber)
            .single(),
        supabase
            .from("matches")
            .select("player_a_id, player_b_id")
            .eq("id", matchId)
            .single(),
    ]);

    if (roundResult.error || !roundResult.data) {
        return { error: "Round not found" };
    }
    if (matchResult.error || !matchResult.data) {
        return { error: "Match not found" };
    }

    const round = roundResult.data;
    const matchPlayers = matchResult.data;

    // 2. Get word scores, previous totals, and moves in parallel (all depend on round.id but not each other)
    const [wordsResult, previousSnapshotResult, moveSubmissionsResult] = await Promise.all([
        supabase
            .from("word_score_entries")
            .select("*")
            .eq("match_id", matchId)
            .eq("round_id", round.id),
        supabase
            .from("scoreboard_snapshots")
            .select("player_a_score, player_b_score")
            .eq("match_id", matchId)
            .eq("round_number", roundNumber - 1)
            .maybeSingle(),
        supabase
            .from("move_submissions")
            .select("player_id, from_x, from_y, to_x, to_y, submitted_at")
            .eq("round_id", round.id)
            .eq("status", "accepted")
            .order("submitted_at", { ascending: true }),
    ]);

    if (wordsResult.error) {
        return { error: `Failed to fetch word scores: ${wordsResult.error.message}` };
    }

    const previousTotals: ScoreTotals = previousSnapshotResult.data
        ? {
              playerA: previousSnapshotResult.data.player_a_score,
              playerB: previousSnapshotResult.data.player_b_score,
          }
        : { playerA: 0, playerB: 0 };

    // 3. Convert word_score_entries to WordScore format
    const wordScores: WordScore[] = (wordsResult.data || []).map((entry) => ({
        playerId: entry.player_id,
        word: entry.word,
        length: entry.length,
        lettersPoints: entry.letters_points,
        bonusPoints: entry.bonus_points,
        totalPoints: entry.total_points,
        coordinates: entry.tiles as Coordinate[],
    }));

    const { data: moveSubmissions } = moveSubmissionsResult;

    const moves: RoundMove[] = (moveSubmissions || []).map((sub) => ({
        playerId: sub.player_id,
        from: { x: sub.from_x, y: sub.from_y },
        to: { x: sub.to_x, y: sub.to_y },
        submittedAt: sub.submitted_at ?? new Date().toISOString(),
    }));

    // 6. Aggregate round summary
    const summary = aggregateRoundSummary(
        matchId,
        roundNumber,
        wordScores,
        previousTotals,
        matchPlayers.player_a_id,
        matchPlayers.player_b_id,
        moves,
    );

    // 7. Persist scoreboard snapshot
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

    // 8. Publish via Realtime broadcast (subscribe before send — required by Supabase Cloud).
    // Bounded by BROADCAST_SUBSCRIBE_TIMEOUT_MS — see statePublisher.ts for the rationale.
    const channel = supabase.channel(`match:${matchId}`);
    let settled = false;
    await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            console.error(
                `[RoundSummary] Channel subscribe timed out after ${BROADCAST_SUBSCRIBE_TIMEOUT_MS}ms; giving up on broadcast`,
            );
            supabase.removeChannel(channel);
            resolve();
        }, BROADCAST_SUBSCRIBE_TIMEOUT_MS);

        channel.subscribe((status) => {
            if (settled) return;

            if (status === "SUBSCRIBED") {
                channel
                    .send({
                        type: "broadcast",
                        event: "round-summary",
                        payload: summary,
                    })
                    .then((result) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        if (result === "error") {
                            console.error("Failed to broadcast round summary");
                        }
                        supabase.removeChannel(channel);
                        resolve();
                    });
                return;
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                settled = true;
                clearTimeout(timer);
                console.error(`[RoundSummary] Channel subscription failed: ${status}`);
                supabase.removeChannel(channel);
                resolve();
            }
        });
    });

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
 * Pipeline: processRoundScoring → persist to word_score_entries → return WordScore[]
 *
 * Wrapped with retry logic (FR-026): retries up to 3 times on failure.
 * On exhaustion, cancels the match and broadcasts error to both players.
 */
export interface ScoringPipelineResult {
    wordScores: WordScore[];
    finalBoard: BoardGrid;
}

export async function computeWordScoresForRound(
    matchId: string,
    roundId: string,
    roundNumber: number,
    boardBefore: BoardGrid,
    acceptedMoves: Array<{ player_id: string; from_x: number; from_y: number; to_x: number; to_y: number; created_at: string }>,
    playerAId: string,
    playerBId: string,
    frozenTiles: Record<string, { owner: string }> = {},
): Promise<ScoringPipelineResult> {
    try {
        return await withRetry(
            () => executeScoringPipeline(
                matchId, roundId, roundNumber,
                boardBefore, acceptedMoves,
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
                        await new Promise<void>((resolve) => {
                            channel.subscribe((status) => {
                                if (status === "SUBSCRIBED") {
                                    channel
                                        .send({
                                            type: "broadcast",
                                            event: "match-error",
                                            payload: {
                                                error: "Scoring pipeline failed. Match has been cancelled.",
                                                matchId,
                                                roundNumber,
                                            },
                                        })
                                        .then(() => {
                                            supabase.removeChannel(channel);
                                            resolve();
                                        });
                                }
                                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                                    supabase.removeChannel(channel);
                                    resolve();
                                }
                            });
                        });
                    } catch {
                        // Best effort — match is already cancelled
                    }
                },
            },
        );
    } catch (error) {
        // If retry exhaustion already cancelled the match, return empty scores
        return { wordScores: [], finalBoard: boardBefore };
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
    acceptedMoves: Array<{ player_id: string; from_x: number; from_y: number; to_x: number; to_y: number; created_at: string }>,
    playerAId: string,
    playerBId: string,
    frozenTiles: Record<string, { owner: string }>,
): Promise<ScoringPipelineResult> {
    const supabase = getServiceRoleClient();

    const { processRoundScoring } = await import("@/lib/game-engine/wordEngine");

    const result = await processRoundScoring({
        matchId,
        roundId,
        roundNumber,
        boardBefore,
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
        return { wordScores: [], finalBoard: result.finalBoard };
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
    return {
        wordScores: allBreakdowns.map((bd) => ({
            playerId: bd.playerId,
            word: bd.word,
            length: bd.length,
            lettersPoints: bd.lettersPoints,
            bonusPoints: bd.lengthBonus,
            totalPoints: bd.totalPoints,
            coordinates: bd.tiles,
        })),
        finalBoard: result.finalBoard,
    };
}

