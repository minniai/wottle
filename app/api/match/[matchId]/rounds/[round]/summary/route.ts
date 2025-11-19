import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { readLobbySession } from "@/lib/matchmaking/profile";
import { aggregateRoundSummary } from "@/lib/scoring/roundSummary";
import type { RoundSummary, WordScore, ScoreTotals } from "@/lib/types/match";
import type { Coordinate } from "@/lib/types/board";

const NO_CACHE_HEADERS = {
    "Cache-Control": "no-store",
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ matchId: string; round: string }> }
) {
    const { matchId, round } = await params;
    const roundNumber = parseInt(round, 10);

    // Validate round number
    if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 10) {
        return NextResponse.json(
            { error: "Round number must be between 1 and 10." },
            { status: 400, headers: NO_CACHE_HEADERS }
        );
    }

    // Check authentication (player must be in the match)
    const session = await readLobbySession();
    if (!session) {
        return NextResponse.json(
            { error: "Authentication required." },
            { status: 401, headers: NO_CACHE_HEADERS }
        );
    }

    const supabase = getServiceRoleClient();

    // Verify player is in match
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("player_a_id, player_b_id")
        .eq("id", matchId)
        .single();

    if (matchError || !match) {
        return NextResponse.json(
            { error: "Match not found." },
            { status: 404, headers: NO_CACHE_HEADERS }
        );
    }

    if (session.player.id !== match.player_a_id && session.player.id !== match.player_b_id) {
        return NextResponse.json(
            { error: "You are not a player in this match." },
            { status: 403, headers: NO_CACHE_HEADERS }
        );
    }

    // Get round record
    const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("id, state, completed_at")
        .eq("match_id", matchId)
        .eq("round_number", roundNumber)
        .single();

    if (roundError || !roundData) {
        return NextResponse.json(
            { error: "Round not found." },
            { status: 404, headers: NO_CACHE_HEADERS }
        );
    }

    if (roundData.state !== "completed") {
        return NextResponse.json(
            { error: "Round is not yet completed." },
            { status: 404, headers: NO_CACHE_HEADERS }
        );
    }

    // Get word score entries for this round
    const { data: wordEntries, error: wordsError } = await supabase
        .from("word_score_entries")
        .select("*")
        .eq("match_id", matchId)
        .eq("round_id", roundData.id);

    if (wordsError) {
        return NextResponse.json(
            { error: "Failed to fetch word scores." },
            { status: 500, headers: NO_CACHE_HEADERS }
        );
    }

    // Get previous score totals
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

    // Convert word_score_entries to WordScore format
    const wordScores: WordScore[] = (wordEntries || []).map((entry) => ({
        playerId: entry.player_id,
        word: entry.word,
        length: entry.length,
        lettersPoints: entry.letters_points,
        bonusPoints: entry.bonus_points,
        totalPoints: entry.total_points,
        coordinates: entry.tiles as Coordinate[],
    }));

    // Aggregate round summary
    const summary: RoundSummary = aggregateRoundSummary(
        matchId,
        roundNumber,
        wordScores,
        previousTotals
    );

    return NextResponse.json(summary, { status: 200, headers: NO_CACHE_HEADERS });
}

