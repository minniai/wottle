"use server";

import { getServiceRoleClient } from "@/lib/supabase/server";
import { aggregateRoundSummary, calculateWordScore } from "@/lib/scoring/roundSummary";
import { recordScoreSnapshot } from "@/lib/matchmaking/service";
import type { RoundSummary, WordScore, ScoreTotals } from "@/lib/types/match";
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

    // 1. Get round with board snapshots
    const { data: round, error: roundError } = await supabase
        .from("rounds")
        .select("id, board_snapshot_before, board_snapshot_after, match_id")
        .eq("match_id", matchId)
        .eq("round_number", roundNumber)
        .single();

    if (roundError || !round) {
        return { error: "Round not found" };
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
        isDuplicate: entry.is_duplicate ?? false,
    }));

    // 5. Aggregate round summary
    const summary = aggregateRoundSummary(
        matchId,
        roundNumber,
        wordScores,
        previousTotals
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
 * Build a map of player ID → set of words already scored in prior rounds for this match.
 * Used to mark duplicates so the same word scores only once per player per match.
 */
async function getPriorScoredWordsByPlayer(
    supabase: ReturnType<typeof getServiceRoleClient>,
    matchId: string,
    currentRoundId: string,
): Promise<Record<string, Set<string>>> {
    const { data: priorEntries } = await supabase
        .from("word_score_entries")
        .select("player_id, word")
        .eq("match_id", matchId)
        .neq("round_id", currentRoundId);

    const byPlayer: Record<string, Set<string>> = {};
    for (const row of priorEntries ?? []) {
        const pid = row.player_id as string;
        const word = (row.word as string).toLowerCase();
        if (!byPlayer[pid]) byPlayer[pid] = new Set();
        byPlayer[pid].add(word);
    }
    return byPlayer;
}

/**
 * Compute word scores from board state and player moves using the word engine.
 * Called by roundEngine after applying moves.
 *
 * Pipeline: getPriorScoredWords → processRoundScoring → persist to word_score_entries → return WordScore[]
 */
export async function computeWordScoresForRound(
    matchId: string,
    roundId: string,
    roundNumber: number,
    boardBefore: BoardGrid,
    boardAfter: BoardGrid,
    acceptedMoves: Array<{ player_id: string; from_x: number; from_y: number; to_x: number; to_y: number }>,
    playerAId: string,
    playerBId: string,
    frozenTiles: Record<string, { owner: string }> = {},
): Promise<WordScore[]> {
    const supabase = getServiceRoleClient();
    const priorScoredWordsByPlayer = await getPriorScoredWordsByPlayer(
        supabase,
        matchId,
        roundId,
    );

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
        })),
        frozenTiles: frozenTiles as import("@/lib/types/match").FrozenTileMap,
        playerAId,
        playerBId,
        priorScoredWordsByPlayer,
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
        is_duplicate: bd.isDuplicate,
    }));

    const { error: insertError } = await supabase
        .from("word_score_entries")
        .insert(entries);

    if (insertError) {
        console.error("Failed to persist word scores:", insertError);
    }

    // Persist updated frozen tiles to the matches table
    const { error: freezeError } = await supabase
        .from("matches")
        .update({
            frozen_tiles: result.newFrozenTiles,
            updated_at: new Date().toISOString(),
        })
        .eq("id", matchId);

    if (freezeError) {
        console.error("Failed to persist frozen tiles:", freezeError);
    }

    // Convert to WordScore[] format for the round summary pipeline
    return allBreakdowns.map((bd) => ({
        playerId: bd.playerId,
        word: bd.word,
        length: bd.length,
        lettersPoints: bd.lettersPoints,
        bonusPoints: bd.lengthBonus,
        totalPoints: bd.totalPoints,
        coordinates: bd.tiles,
        isDuplicate: bd.isDuplicate,
    }));
}

